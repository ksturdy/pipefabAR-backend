const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initializeDatabase } = require('./db');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const workPackageRoutes = require('./routes/workPackages');
const spoolRoutes = require('./routes/spools');
const specificationRoutes = require('./routes/specifications');
const profileRoutes = require('./routes/profile');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/workPackages', workPackageRoutes);
app.use('/api/spools', spoolRoutes);
app.use('/api/specifications', specificationRoutes);
app.use('/api/profile', profileRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/migrate', async (req, res) => {
  const client = await pool.connect();
  try {
    // Drop existing tables in reverse dependency order
    await client.query('DROP TABLE IF EXISTS spools CASCADE');
    await client.query('DROP TABLE IF EXISTS work_packages CASCADE');
    await client.query('DROP TABLE IF EXISTS projects CASCADE');
    await client.query('DROP TABLE IF EXISTS pipe_specifications CASCADE');
    await client.query('DROP TABLE IF EXISTS user_profiles CASCADE');
    await client.query('DROP TABLE IF EXISTS users CASCADE');

    // Create tables
    const statements = [
      `CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, subscription_tier VARCHAR(50) DEFAULT 'free', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE user_profiles (id SERIAL PRIMARY KEY, user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE, name VARCHAR(255), phone_number VARCHAR(20), email VARCHAR(255))`,
      `CREATE TABLE pipe_specifications (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, spec_description VARCHAR(255) NOT NULL, abbreviation VARCHAR(50) NOT NULL, sort_order INTEGER DEFAULT 0, is_default BOOLEAN DEFAULT FALSE)`,
      `CREATE TABLE projects (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, job_number VARCHAR(100), color VARCHAR(7), spool_naming_template VARCHAR(255) DEFAULT '{jobNumber}-{packageNumber}-{spoolNumber}', next_spool_number INTEGER DEFAULT 1, default_pipe_specification_id INTEGER REFERENCES pipe_specifications(id) ON DELETE SET NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE work_packages (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, name VARCHAR(255) NOT NULL, package_number VARCHAR(100), status VARCHAR(50) DEFAULT 'Not Started', due_date DATE, notes TEXT, pipe_specification_id INTEGER REFERENCES pipe_specifications(id) ON DELETE SET NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE spools (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, work_package_id INTEGER REFERENCES work_packages(id) ON DELETE SET NULL, name VARCHAR(255) NOT NULL, system_type VARCHAR(50), status VARCHAR(50) DEFAULT 'Draft', pipe_points_data JSONB DEFAULT '[]', zoom_scale DECIMAL(5,2) DEFAULT 1.0, pan_offset_x DECIMAL(10,2) DEFAULT 0, pan_offset_y DECIMAL(10,2) DEFAULT 0, thumbnail_data TEXT, pipe_specification_id INTEGER REFERENCES pipe_specifications(id) ON DELETE SET NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE INDEX idx_users_email ON users(email)`,
      `CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id)`,
      `CREATE INDEX idx_pipe_specs_user_id ON pipe_specifications(user_id)`,
      `CREATE INDEX idx_projects_user_id ON projects(user_id)`,
      `CREATE INDEX idx_work_packages_project_id ON work_packages(project_id)`,
      `CREATE INDEX idx_spools_project_id ON spools(project_id)`,
      `CREATE INDEX idx_spools_work_package_id ON spools(work_package_id)`,
    ];

    for (const statement of statements) {
      await client.query(statement);
    }

    res.json({ message: 'Migration complete - tables recreated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
