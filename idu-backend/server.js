'use strict';

require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { generalLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const studentsRoutes = require('./routes/students');
const gradesRoutes = require('./routes/grades');
const teachersRoutes = require('./routes/teachers');
const scheduleRoutes = require('./routes/schedule');
const applicationsRoutes = require('./routes/applications');
const questionsRoutes = require('./routes/questions');
const aiRoutes = require('./routes/ai');
const examsRoutes = require('./routes/exams');
const assignmentsRoutes = require('./routes/assignments');
const submissionsRoutes = require('./routes/submissions');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://idu-platform-production.up.railway.app',
];

if (process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN.split(',').forEach((origin) => {
    if (origin.trim()) allowedOrigins.push(origin.trim());
  });
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (/\.railway\.app$/.test(origin)) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || './uploads')));

app.get('/health', function (req, res) {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    version: '3.0.0'
  });
});

app.use('/api', generalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/grades', gradesRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/submissions', submissionsRoutes);

/* FRONTEND — monorepo: node idu-backend/server.js buyrug'i bilan ishlaganda
   cwd = repo root, shuning uchun 'idu-frontend' to'g'ridan topiladi */
const frontendCandidates = [
  path.resolve(process.cwd(), 'idu-frontend'),          // monorepo root (Railway)
  path.resolve(__dirname, '../idu-frontend'),            // local: idu-backend/../idu-frontend
  path.resolve(__dirname, 'public'),                     // fallback: idu-backend/public
  path.resolve(process.cwd(), 'idu-backend/public'),     // legacy fallback
];

const frontendDir = frontendCandidates.find((dir) => {
  return fs.existsSync(path.join(dir, 'index.html'));
});

if (!frontendDir) {
  console.warn('Frontend index.html topilmadi. Tekshirilgan papkalar:');
  frontendCandidates.forEach((dir) => console.warn(' - ' + dir));
} else {
  console.log('Frontend dir: ' + frontendDir);

  app.use(express.static(frontendDir, {
    maxAge: 0,
    etag: false,
    lastModified: false,
    setHeaders: function (res) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }));
}

app.get('*', function (req, res, next) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  if (!frontendDir) {
    return res.status(500).send('Frontend index.html topilmadi');
  }

  return res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '3000', 10);
const runMigrations = require('./migrate');

runMigrations()
  .then(function () {
    app.listen(PORT, '0.0.0.0', function () {
      console.log('================================================');
      console.log('  IDU Platform v3.0 - Railway Edition');
      console.log('  Port     : ' + PORT);
      console.log('  Env      : ' + (process.env.NODE_ENV || 'development'));
      console.log('  Frontend : ' + (frontendDir || 'NOT FOUND'));
      console.log('  API      : /api/*');
      console.log('================================================');
    });
  })
  .catch(function (err) {
    console.error('Startup error:', err);
    process.exit(1);
  });

module.exports = app;
