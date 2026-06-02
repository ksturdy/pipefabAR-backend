const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    let result = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      result = await pool.query(
        'INSERT INTO user_profiles (user_id) VALUES ($1) RETURNING *',
        [req.user.id]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const { name, phone_number, email } = req.body;

    let result = await pool.query(
      'SELECT id FROM user_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      result = await pool.query(
        'INSERT INTO user_profiles (user_id, name, phone_number, email) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.user.id, name || '', phone_number || '', email || '']
      );
    } else {
      result = await pool.query(
        'UPDATE user_profiles SET name = $1, phone_number = $2, email = $3 WHERE user_id = $4 RETURNING *',
        [name || '', phone_number || '', email || '', req.user.id]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
