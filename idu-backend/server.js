'use strict';

require('dotenv').config();
require('express-async-errors');

const { validateEnv } = require('./config/env');
validateEnv(); // fail fast if critical env vars missing

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const path         = require('path');
const fs           = require('fs');

const { logger, requestLogger } = require('./middleware/logger');
const { generalLimiter }        = require('./middleware/rateLimiter');
const errorHandler              = require('./middleware/errorHandler');

const authRoutes        = require('./routes/auth');
const studentsRoutes    = require('./routes/students');
const gradesRoutes      = require('./routes/grades');
const teachersRoutes    = require('./routes/teachers');
const scheduleRoutes    = require('./routes/schedule');
const applicationsRoutes= require('./routes/applications');
const questionsRoutes   = require('./routes/questions');
const aiRoutes          = require('./routes/ai');
const examsRoutes       = require('./routes/exams');
const assignmentsRoutes = require('./routes/assignments');
const submissionsRoutes = require('./routes/submissions');

const app = express();

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://idu-platform-production.up.railway.app',
]);

if (process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN.split(',').forEach((o) => {
    if (o.trim()) allowedOrigins.add(o.trim());
  });
}

app.use(cors({
  origin: (origin, callback) => {
    // Same-origin requests (no Origin header) are always ok
    if (!origin) return callback(null, true);
    // Explicit allow-list + Railway subdomains
    if (allowedOrigins.has(origin) || /\.railway\.app$/.test(origin)) {
      return callback(null, true);
    }
    logger.warn(`CORS blocked: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body / Cookie parsers ─────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());

// ── HTTP request logging ──────────────────────────────────────────────────────
app.use(requestLogger);

// ── Static uploads ────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || './uploads')));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV,
    version:   '4.0.0',
  });
});

// ── API v1 routes ─────────────────────────────────────────────────────────────
app.use('/api/v1', generalLimiter);

app.use('/api/v1/auth',         authRoutes);
app.use('/api/v1/students',     studentsRoutes);
app.use('/api/v1/grades',       gradesRoutes);
app.use('/api/v1/teachers',     teachersRoutes);
app.use('/api/v1/schedule',     scheduleRoutes);
app.use('/api/v1/applications', applicationsRoutes);
app.use('/api/v1/questions',    questionsRoutes);
app.use('/api/v1/ai',           aiRoutes);
app.use('/api/v1/exams',        examsRoutes);
app.use('/api/v1/assignments',  assignmentsRoutes);
app.use('/api/v1/submissions',  submissionsRoutes);

// Legacy /api/* → redirect to /api/v1/* for backwards compatibility
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/v1')) return next();
  // Rewrite and forward
  req.url = '/v1' + req.url;
  app.handle(req, res, next);
});

// ── Frontend SPA ──────────────────────────────────────────────────────────────
const frontendCandidates = [
  path.resolve(process.cwd(), 'idu-frontend'),
  path.resolve(__dirname, '../idu-frontend'),
  path.resolve(__dirname, 'public'),
];

const frontendDir = frontendCandidates.find((dir) =>
  fs.existsSync(path.join(dir, 'index.html'))
);

if (!frontendDir) {
  logger.warn('Frontend index.html not found. Checked: ' + frontendCandidates.join(', '));
} else {
  logger.info('Frontend: ' + frontendDir);
  app.use(express.static(frontendDir, {
    maxAge: 0,
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    },
  }));
}

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  if (!frontendDir) return res.status(500).send('Frontend not found');
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
const runMigrations = require('./migrate');

runMigrations()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      logger.info('═══════════════════════════════════════');
      logger.info('  IDU Platform v4.0');
      logger.info(`  Port    : ${PORT}`);
      logger.info(`  Env     : ${process.env.NODE_ENV}`);
      logger.info(`  API     : /api/v1/*`);
      logger.info(`  Frontend: ${frontendDir || 'NOT FOUND'}`);
      logger.info('═══════════════════════════════════════');
    });
  })
  .catch((err) => {
    logger.error('Startup failed:', err);
    process.exit(1);
  });

module.exports = app;
