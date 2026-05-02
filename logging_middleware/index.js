// index.js - Logging Middleware Demo Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { requestLogger, errorLogger } = require('./middleware');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Core Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Logging Middleware (attach before all routes) ────────────────
app.use(requestLogger);

// ── Health Check ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'logging-middleware',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── Demo Routes ──────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'Logging Middleware is active', requestId: req.requestId });
});

app.post('/echo', (req, res) => {
  res.json({ echo: req.body, requestId: req.requestId });
});

app.get('/error-demo', (req, res, next) => {
  next(new Error('Demo error for logging test'));
});

// ── 404 Handler ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

// ── Error Logger (after all routes) ─────────────────────────────
app.use(errorLogger);

// ── Global Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    requestId: req.requestId,
  });
});

// ── Start Server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Logging Middleware server running on http://localhost:${PORT}`);
});

module.exports = { app, requestLogger, errorLogger, logger };
