'use strict';

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, colorize, printf, json, errors } = format;

const isDev = process.env.NODE_ENV !== 'production';

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const extras = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp} ${level}: ${stack || message}${extras}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  format: isDev ? devFormat : prodFormat,
  transports: [
    new transports.Console(),
  ],
  exitOnError: false,
});

// Express HTTP request logger middleware
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';
    logger[level] || logger.info.bind(logger);
    (logger[level] || logger.info).call(logger, `${req.method} ${req.path} ${res.statusCode} ${ms}ms`, {
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 80),
    });
  });
  next();
}

module.exports = { logger, requestLogger };
