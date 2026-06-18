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
const promoRoutes = require('./routes/promo');
const adminRoutes = require('./routes/admin');

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
app.use('/api/promo', promoRoutes);
app.use('/admin', adminRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const startServer = async () => {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
