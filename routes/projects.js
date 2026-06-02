const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, ps.spec_description, ps.abbreviation
       FROM projects p
       LEFT JOIN pipe_specifications ps ON p.default_pipe_specification_id = ps.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, job_number, color, spool_naming_template } = req.body;
    const result = await pool.query(
      `INSERT INTO projects (user_id, name, job_number, color, spool_naming_template)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, name, job_number || '', color || '#007AFF', spool_naming_template || '{jobNumber}-{packageNumber}-{spoolNumber}']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const project = await pool.query(
      'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (project.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const workPackages = await pool.query(
      'SELECT * FROM work_packages WHERE project_id = $1 ORDER BY created_at',
      [req.params.id]
    );

    const spools = await pool.query(
      'SELECT * FROM spools WHERE project_id = $1 ORDER BY created_at',
      [req.params.id]
    );

    res.json({ ...project.rows[0], work_packages: workPackages.rows, spools: spools.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, job_number, color, spool_naming_template } = req.body;
    const result = await pool.query(
      `UPDATE projects
       SET name = $1, job_number = $2, color = $3, spool_naming_template = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [name, job_number, color, spool_naming_template, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
