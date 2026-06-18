const router = require('express').Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// POST /promo/redeem
router.post('/redeem', authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user.id;
    if (!code) return res.status(400).json({ error: 'code is required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: codeRows } = await client.query(
        'SELECT * FROM promo_codes WHERE code = $1 FOR UPDATE',
        [code.toUpperCase().trim()]
      );

      if (codeRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Invalid promo code' });
      }

      const promo = codeRows[0];

      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        await client.query('ROLLBACK');
        return res.status(410).json({ error: 'Promo code has expired' });
      }

      if (promo.current_uses >= promo.max_uses) {
        await client.query('ROLLBACK');
        return res.status(410).json({ error: 'Promo code is no longer available' });
      }

      const { rows: existing } = await client.query(
        'SELECT * FROM promo_code_redemptions WHERE promo_code_id = $1 AND user_id = $2',
        [promo.id, userId]
      );

      if (existing.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'You have already redeemed this code' });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + promo.grant_duration_days);

      await client.query(
        'INSERT INTO promo_code_redemptions (promo_code_id, user_id, access_expires_at) VALUES ($1, $2, $3)',
        [promo.id, userId, expiresAt]
      );

      await client.query(
        'UPDATE promo_codes SET current_uses = current_uses + 1, updated_at = NOW() WHERE id = $1',
        [promo.id]
      );

      await client.query('COMMIT');

      const expiresDate = expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      res.json({ success: true, message: `Code redeemed! Pro access granted until ${expiresDate}.`, expiresAt });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /promo/status  — check if authenticated user has active promo access
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT access_expires_at, (access_expires_at > NOW()) AS is_active
       FROM promo_code_redemptions
       WHERE user_id = $1
       ORDER BY access_expires_at DESC
       LIMIT 1`,
      [req.user.id]
    );

    if (rows.length === 0 || !rows[0].is_active) {
      return res.json({ hasPromoAccess: false });
    }

    res.json({ hasPromoAccess: true, expiresAt: rows[0].access_expires_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
