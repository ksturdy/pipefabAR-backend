const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

const DEFAULT_SPECS = [
  { description: 'Carbon Steel Schedule 40', abbreviation: 'CS SCH 40' },
  { description: 'Carbon Steel Schedule 80', abbreviation: 'CS SCH 80' },
  { description: 'Stainless Steel Schedule 10', abbreviation: 'SS SCH 10' },
  { description: 'Stainless Steel Schedule 40', abbreviation: 'SS SCH 40' },
  { description: 'PVC Schedule 40', abbreviation: 'PVC SCH 40' },
  { description: 'PVC Schedule 80', abbreviation: 'PVC SCH 80' },
  { description: 'Copper Type K', abbreviation: 'CU TYPE K' },
  { description: 'Copper Type L', abbreviation: 'CU TYPE L' },
  { description: 'Copper Type M', abbreviation: 'CU TYPE M' },
];

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM pipe_specifications WHERE user_id = $1 ORDER BY sort_order ASC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/init', async (req, res) => {
  try {
    const existingSpecs = await pool.query(
      'SELECT COUNT(*) FROM pipe_specifications WHERE user_id = $1',
      [req.user.id]
    );

    if (existingSpecs.rows[0].count > 0) {
      return res.json({ message: 'Specifications already initialized' });
    }

    const insertedSpecs = [];
    for (let i = 0; i < DEFAULT_SPECS.length; i++) {
      const spec = DEFAULT_SPECS[i];
      const result = await pool.query(
        `INSERT INTO pipe_specifications (user_id, spec_description, abbreviation, sort_order, is_default)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.user.id, spec.description, spec.abbreviation, i, i === 0]
      );
      insertedSpecs.push(result.rows[0]);
    }

    res.json(insertedSpecs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { spec_description, abbreviation } = req.body;
    const maxSort = await pool.query(
      'SELECT MAX(sort_order) as max_sort FROM pipe_specifications WHERE user_id = $1',
      [req.user.id]
    );
    const nextSort = (maxSort.rows[0].max_sort || -1) + 1;

    const result = await pool.query(
      `INSERT INTO pipe_specifications (user_id, spec_description, abbreviation, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, spec_description, abbreviation, nextSort]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { spec_description, abbreviation, sort_order } = req.body;
    const result = await pool.query(
      `UPDATE pipe_specifications
       SET spec_description = $1, abbreviation = $2, sort_order = $3
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [spec_description, abbreviation, sort_order, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/set-default', async (req, res) => {
  try {
    await pool.query(
      'UPDATE pipe_specifications SET is_default = FALSE WHERE user_id = $1',
      [req.user.id]
    );
    const result = await pool.query(
      `UPDATE pipe_specifications SET is_default = TRUE
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM pipe_specifications WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Specification not found' });
    }
    res.json({ message: 'Specification deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
