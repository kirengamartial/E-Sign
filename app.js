const express = require('express');
const app = express();

app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
const signRoutes = require('./routes/signRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/sign', signRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = app;
