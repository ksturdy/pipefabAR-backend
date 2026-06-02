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

    await initializeDatabase();
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
