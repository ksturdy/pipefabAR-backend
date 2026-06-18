const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const appleSignin = require('apple-signin-auth');
const { pool } = require('../db');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, subscription_tier',
      [email, hashedPassword]
    );

    const token = jwt.sign({ id: result.rows[0].id, email }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({ user: result.rows[0], token });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      user: { id: user.id, email: user.email, subscription_tier: user.subscription_tier },
      token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/apple  — Sign In with Apple
router.post('/apple', async (req, res) => {
  try {
    const { identityToken, fullName } = req.body;
    if (!identityToken) return res.status(400).json({ error: 'identityToken is required' });

    const { sub: appleId, email } = await appleSignin.verifyIdToken(identityToken, {
      audience: process.env.APPLE_BUNDLE_ID,
    });

    let { rows } = await pool.query('SELECT * FROM users WHERE apple_id = $1', [appleId]);
    let user = rows[0];

    if (!user) {
      const result = await pool.query(
        `INSERT INTO users (apple_id, email, full_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET apple_id = EXCLUDED.apple_id RETURNING *`,
        [appleId, email || null, fullName || null]
      );
      user = result.rows[0];
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, fullName: user.full_name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
