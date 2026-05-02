// middleware.js - HTTP request/response logging middleware
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

/**
 * Request Logger Middleware
 * Logs every incoming request and its corresponding response.
 * Attaches a unique requestId to each request for tracing.
 */
const requestLogger = (req, res, next) => {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Attach requestId to request and response headers for tracing
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Log incoming request
  logger.info('Incoming Request', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    query: req.query,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'authorization': req.headers['authorization'] ? '[PRESENT]' : '[ABSENT]',
    },
    ip: req.ip || req.connection?.remoteAddress,
    body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
  });

  // Intercept response finish to log response details
  const originalEnd = res.end.bind(res);
  res.end = function (chunk, encoding) {
    const duration = Date.now() - startTime;
    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.getHeader('content-length') || (chunk ? chunk.length : 0),
    };

    if (res.statusCode >= 500) {
      logger.error('Response Sent', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Response Sent', logData);
    } else {
      logger.info('Response Sent', logData);
    }

    originalEnd(chunk, encoding);
  };

  next();
};

/**
 * Error Logger Middleware
 * Logs unhandled errors that reach the Express error handler.
 */
const errorLogger = (err, req, res, next) => {
  logger.error('Unhandled Error', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    error: {
      message: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : '[hidden in production]',
      name: err.name,
    },
  });
  next(err);
};

/**
 * Remove sensitive fields from request body before logging
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'apiKey'];
  sensitiveFields.forEach((field) => {
    if (sanitized[field]) sanitized[field] = '[REDACTED]';
  });
  return sanitized;
}

module.exports = { requestLogger, errorLogger };
