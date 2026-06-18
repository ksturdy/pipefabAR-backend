const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    const statements = [
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        apple_id VARCHAR(255) UNIQUE,
        email VARCHAR(255) UNIQUE,
        full_name VARCHAR(255),
        password VARCHAR(255),
        subscription_tier VARCHAR(50) DEFAULT 'free',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      // Add columns to existing installs
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255) UNIQUE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)`,
      `CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255),
        phone_number VARCHAR(20),
        email VARCHAR(255)
      )`,
      `CREATE TABLE IF NOT EXISTS pipe_specifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        spec_description VARCHAR(255) NOT NULL,
        abbreviation VARCHAR(50) NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_default BOOLEAN DEFAULT FALSE
      )`,
      `CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        job_number VARCHAR(100),
        color VARCHAR(7),
        spool_naming_template VARCHAR(255) DEFAULT '{jobNumber}-{packageNumber}-{spoolNumber}',
        next_spool_number INTEGER DEFAULT 1,
        default_pipe_specification_id INTEGER REFERENCES pipe_specifications(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS work_packages (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        package_number VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Not Started',
        due_date DATE,
        notes TEXT,
        pipe_specification_id INTEGER REFERENCES pipe_specifications(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS spools (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        work_package_id INTEGER REFERENCES work_packages(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        system_type VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Draft',
        pipe_points_data JSONB DEFAULT '[]',
        zoom_scale DECIMAL(5,2) DEFAULT 1.0,
        pan_offset_x DECIMAL(10,2) DEFAULT 0,
        pan_offset_y DECIMAL(10,2) DEFAULT 0,
        thumbnail_data TEXT,
        pipe_specification_id INTEGER REFERENCES pipe_specifications(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS promo_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        max_uses INTEGER NOT NULL DEFAULT 1,
        current_uses INTEGER NOT NULL DEFAULT 0,
        grant_duration_days INTEGER NOT NULL DEFAULT 365,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS promo_code_redemptions (
        id SERIAL PRIMARY KEY,
        promo_code_id INTEGER NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        redeemed_at TIMESTAMPTZ DEFAULT NOW(),
        access_expires_at TIMESTAMPTZ NOT NULL,
        UNIQUE(promo_code_id, user_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
      `CREATE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id)`,
      `CREATE INDEX IF NOT EXISTS idx_pipe_specs_user_id ON pipe_specifications(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_work_packages_project_id ON work_packages(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_spools_project_id ON spools(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_code_redemptions(user_id)`,
    ];

    for (const statement of statements) {
      await client.query(statement);
    }
    console.log('Database initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  initializeDatabase,
};
