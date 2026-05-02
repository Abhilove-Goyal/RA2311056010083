// index.js - Campus Notifications Microservice
require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Shared logging middleware
let requestLogger, errorLogger, logger;
try {
  ({ requestLogger, errorLogger } = require('../logging_middleware/middleware'));
  logger = require('../logging_middleware/logger');
} catch {
  requestLogger = (req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  };
  errorLogger = (err, req, res, next) => { console.error(err); next(err); };
  logger = console;
}

const routes = require('./routes');
const app = express();
const PORT = process.env.PORT || 3002;

// ── Middleware ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// ── Routes ────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'campus-notifications',
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
  logger.info(`Campus Notifications service running on http://localhost:${PORT}`);
  logger.info(`  GET  http://localhost:${PORT}/api/notifications`);
  logger.info(`  GET  http://localhost:${PORT}/api/notifications/unread`);
  logger.info(`  GET  http://localhost:${PORT}/api/notifications/priority?n=10`);
  logger.info(`  GET  http://localhost:${PORT}/api/notifications/type/:type`);
  logger.info(`  GET  http://localhost:${PORT}/api/notifications/placement/recent`);
  logger.info(`  POST http://localhost:${PORT}/api/notifications/notify-all`);
});

module.exports = app;
