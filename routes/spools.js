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

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM spools WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Spool not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, work_package_id, name, system_type, status, pipe_points_data } = req.body;
    const result = await pool.query(
      `INSERT INTO spools (project_id, work_package_id, name, system_type, status, pipe_points_data)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [project_id, work_package_id || null, name || 'Spool', system_type || null, status || 'Draft', pipe_points_data || []]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, system_type, status, pipe_points_data, zoom_scale, pan_offset_x, pan_offset_y, work_package_id } = req.body;
    const jsonbData = pipe_points_data ? JSON.stringify(pipe_points_data) : JSON.stringify([]);
    const result = await pool.query(
      `UPDATE spools
       SET name = $1, system_type = $2, status = $3, pipe_points_data = $4::jsonb, zoom_scale = $5,
           pan_offset_x = $6, pan_offset_y = $7, work_package_id = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 RETURNING *`,
      [name, system_type, status, jsonbData, zoom_scale || 1.0, pan_offset_x || 0, pan_offset_y || 0, work_package_id || null, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Spool not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Spool update error:', err);
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
