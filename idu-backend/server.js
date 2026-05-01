'use strict';

// Load env vars
require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const path    = require('path');

const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler       = require('./middleware/errorHandler');

// Routes
const authRoutes         = require('./routes/auth');
const studentsRoutes     = require('./routes/students');
const gradesRoutes       = require('./routes/grades');
const teachersRoutes     = require('./routes/teachers');
const scheduleRoutes     = require('./routes/schedule');
const applicationsRoutes = require('./routes/applications');
const questionsRoutes    = require('./routes/questions');
const aiRoutes           = require('./routes/ai');
const examsRoutes        = require('./routes/exams');
const assignmentsRoutes  = require('./routes/assignments');
const submissionsRoutes  = require('./routes/submissions');

const app = express();

// ── Security headers ─────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'cdnjs.cloudflare.com', 'fonts.googleapis.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      fontSrc:    ["'self'", 'fonts.gstatic.com', 'data:'],
      imgSrc:     ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https:', 'wss:'],
      mediaSrc:   ["'self'", 'blob:'],
      workerSrc:  ["'self'", 'blob:'],
      frameSrc:   ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ─────────────────────────────────────────────────────────
// Same-origin (Railway) — frontend va backend bitta URL
// Boshqa originlarga ham ruxsat (development uchun)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

// CORS_ORIGIN env dan qo'shimcha originlar
if (process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN.split(',').forEach(function(o) {
    allowedOrigins.push(o.trim());
  });
}

app.use(cors({
  origin: function(origin, callback) {
    // Same-origin (null origin) yoki ruxsat berilgan
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Railway domeniga o'zi ham ruxsat
    if (/\.railway\.app$/.test(origin)) return callback(null, true);
    if (/\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(null, true); // Production da barcha originlarga ruxsat
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ──────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// ── Static files (uploaded avatars) ──────────────────────────────
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || './uploads')));

// ── Health check ──────────────────────────────────────────────────
app.get('/health', function(req, res) {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    version: '3.0.0'
  });
});

// ── Rate limiter ──────────────────────────────────────────────────
app.use('/api', generalLimiter);

// ── API Routes ────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/students',     studentsRoutes);
app.use('/api/grades',       gradesRoutes);
app.use('/api/teachers',     teachersRoutes);
app.use('/api/schedule',     scheduleRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/questions',    questionsRoutes);
app.use('/api/ai',           aiRoutes);
app.use('/api/exams',        examsRoutes);
app.use('/api/assignments',  assignmentsRoutes);
app.use('/api/submissions',  submissionsRoutes);

// ── Frontend static files (SPA) ───────────────────────────────────
const publicDir = path.resolve(__dirname, 'public');
app.use(express.static(publicDir, {
  maxAge: '1h',
  etag: true,
  setHeaders: function(res, filePath) {
    // HTML fayllar cache qilinmasin (yangi deploy darhol ishlashi uchun)
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ── SPA fallback — barcha GET so'rovlar index.html qaytaradi ─────
app.get('*', function(req, res) {
  // API so'rovlar bundan mustasno
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ── Error handler ─────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
const runMigrations = require('./migrate');

runMigrations()
  .then(function() {
    app.listen(PORT, '0.0.0.0', function() {
      console.log('================================================');
      console.log('  IDU Platform v3.0 - Railway Edition');
      console.log('  Port     : ' + PORT);
      console.log('  Env      : ' + (process.env.NODE_ENV || 'development'));
      console.log('  Frontend : /public (SPA mode)');
      console.log('  API      : /api/*');
      console.log('================================================');
    });
  })
  .catch(function(err) {
    console.error('Startup error:', err);
    process.exit(1);
  });

module.exports = app;
