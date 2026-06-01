const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/workPackage/:workPackageId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM spools WHERE work_package_id = $1 ORDER BY created_at DESC',
      [req.params.workPackageId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { work_package_id, size, material, quantity } = req.body;
    const result = await pool.query(
      'INSERT INTO spools (work_package_id, size, material, quantity) VALUES ($1, $2, $3, $4) RETURNING *',
      [work_package_id, size, material, quantity]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { size, material, quantity } = req.body;
    const result = await pool.query(
      'UPDATE spools SET size = $1, material = $2, quantity = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [size, material, quantity, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Spool not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM spools WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Spool not found' });
    }
    res.json({ message: 'Spool deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
