// index.js - Vehicle Maintenance Scheduler Microservice
require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import shared logging middleware from sibling folder
let requestLogger, errorLogger, logger;
try {
  ({ requestLogger, errorLogger } = require('../logging_middleware/middleware'));
  logger = require('../logging_middleware/logger');
} catch {
  // Fallback: simple console logger if running standalone
  requestLogger = (req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  };
  errorLogger = (err, req, res, next) => { console.error(err); next(err); };
  logger = console;
}

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// ── Routes ────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'vehicle-maintenance-scheduler',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', routes);

// ── 404 ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

// ── Error Handlers ────────────────────────────────────────────────
app.use(errorLogger);
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Vehicle Maintenance Scheduler running on http://localhost:${PORT}`);
  logger.info(`  POST http://localhost:${PORT}/api/schedule`);
  logger.info(`  GET  http://localhost:${PORT}/api/depots`);
  logger.info(`  GET  http://localhost:${PORT}/api/vehicles`);
  logger.info(`  POST http://localhost:${PORT}/api/schedule/custom`);
});

module.exports = app;
