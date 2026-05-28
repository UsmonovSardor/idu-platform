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

const compression             = require('compression');
const hpp                     = require('hpp');
const { logger, requestLogger } = require('./middleware/logger');
const { generalLimiter }        = require('./middleware/rateLimiter');
const errorHandler              = require('./middleware/errorHandler');
const { sanitizeBody, noSniff } = require('./middleware/security');

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
const attendanceRoutes  = require('./routes/attendance');
const messagesRoutes    = require('./routes/messages');
const gamificationRoutes= require('./routes/gamification');
const documentsRoutes   = require('./routes/documents');
const rectorRoutes      = require('./routes/rector');
const teacherExamsRoutes= require('./routes/teacherExams');
const auditLogRoutes    = require('./routes/auditLog');
const subjectsRoutes    = require('./routes/subjects');
const pushRoutes        = require('./routes/push');
const forumRoutes       = require('./routes/forum');
const { audit }         = require('./middleware/audit');

const http            = require('http');
const { setupSocket } = require('./socket');

const app        = express();
const httpServer = http.createServer(app);

// ── Gzip compression (before everything else) ────────────────────────────────
app.use(compression({
  level: 6,           // good balance of speed vs ratio
  threshold: 1024,    // don't compress responses < 1 KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// ── Security headers (Phase D: CSP enabled) ──────────────────────────────────
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(helmet({
  // Content-Security-Policy
  // The frontend uses inline onclick=... handlers throughout, so unsafe-inline
  // must stay for script-src and script-src-attr.
  // All CDN domains used by the app are explicitly listed.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],

      // Scripts: self + CDNs + inline handlers (onclick=...)
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",          // required: inline onclick/onchange handlers
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
        'https://fonts.googleapis.com',
      ],

      // Inline onclick attr also needs this separate directive
      scriptSrcAttr: ["'unsafe-inline'"],

      // Styles: self + font CDNs + inline styles
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
      ],

      // Fonts: self + Google Fonts CDN + data URIs
      fontSrc: [
        "'self'",
        'data:',
        'https://fonts.gstatic.com',
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
      ],

      // Images: allow any HTTPS + data URIs + blob
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],

      // Fetch/XHR/WebSocket connections: self + AI APIs + CDNs
      connectSrc: [
        "'self'",
        'wss:',                         // socket.io WebSocket upgrade
        'https://api.openai.com',
        'https://api.anthropic.com',
        'https://cdn.jsdelivr.net',
        'https://cdnjs.cloudflare.com',
        ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : []),
      ],

      // Frames, objects — block entirely
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
      baseUri:    ["'self'"],
      formAction: ["'self'"],

      // Force HTTPS in production (omit entirely in dev — helmet rejects `undefined`)
      ...(IS_PROD ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  // Prevent clickjacking
  frameguard:               { action: 'sameorigin' },
  // HSTS — 1 year in production
  hsts:                     IS_PROD ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
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
// 10 MB only for multipart (avatars); JSON/form bodies capped at 256 KB
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));
app.use(cookieParser());

// ── HTTP Parameter Pollution (HPP) guard ─────────────────────────────────────
// Prevents ?sort=asc&sort=desc&sort=DROP attacks by keeping only last value
app.use(hpp());

// ── Prototype-pollution sanitizer ────────────────────────────────────────────
// Strips __proto__ / constructor keys from body, query, params
app.use(sanitizeBody());

// ── HTTP request logging ──────────────────────────────────────────────────────
app.use(requestLogger);

// ── Static uploads ────────────────────────────────────────────────────────────
// noSniff prevents browser from executing an uploaded file as script even if
// its Content-Type is wrong. authenticate gates download to logged-in users.
app.use('/uploads', noSniff(), express.static(path.resolve(process.env.UPLOAD_DIR || './uploads'), {
  // Never cache upload responses — use must-revalidate to avoid stale avatars
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'private, no-cache');
  },
}));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  // Do not expose NODE_ENV — reveals deployment environment to attackers
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    version:   '4.1.0',
  });
});

// ── API routes (v1 + legacy /api/* aliases) ──────────────────────────────────
app.use('/api/v1', generalLimiter);
app.use('/api',    generalLimiter);
// Audit log middleware — fire-and-forget, after rate limiter
app.use('/api', audit());

// Register each router under both /api/v1/* and /api/* (backwards compat)
const routeMap = [
  ['/auth',         authRoutes],
  ['/students',     studentsRoutes],
  ['/grades',       gradesRoutes],
  ['/teachers',     teachersRoutes],
  ['/schedule',     scheduleRoutes],
  ['/applications', applicationsRoutes],
  ['/questions',    questionsRoutes],
  ['/ai',           aiRoutes],
  ['/exams',        examsRoutes],
  ['/assignments',  assignmentsRoutes],
  ['/submissions',  submissionsRoutes],
  ['/attendance',    attendanceRoutes],
  ['/messages',      messagesRoutes],
  ['/gamification',  gamificationRoutes],
  ['/documents',     documentsRoutes],
  ['/rector',        rectorRoutes],
  ['/teacher-exams', teacherExamsRoutes],
  ['/audit-log',     auditLogRoutes],
  ['/subjects',      subjectsRoutes],
  ['/push',          pushRoutes],
  ['/forum',         forumRoutes],
];

routeMap.forEach(([path, router]) => {
  app.use('/api/v1' + path, router);
  app.use('/api'    + path, router); // legacy alias
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

  // ── Pre-static middleware: force Cache-Control on EVERY frontend response ──
  // Railway edge proxy strips/overrides headers set by express.static's setHeaders
  // when no header is present at proxy level. Setting it directly via `res.on('headersSent')`
  // before any other middleware ensures the header survives the proxy.
  app.use((req, res, next) => {
    const p = (req.path || '').toLowerCase();
    if (p.startsWith('/api/') || p.startsWith('/uploads/')) return next();
    // Versioned assets (?v=…) — they're already cache-busted, so allow long-cache
    // for fonts/images, but force revalidation for code/style files.
    if (/\.(png|jpg|jpeg|gif|ico|svg|webp|woff2?|ttf|eot)$/.test(p)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    } else if (/\.(css|js|mjs|map)$/.test(p)) {
      // CSS / JS — always revalidate. With ?v=… the URL changes per deploy,
      // so 304s are cheap but stale serves are catastrophic.
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    } else if (p === '/' || p.endsWith('.html') || p.endsWith('/sw.js') || p === '/sw.js') {
      // HTML / Service Worker — never cache anywhere
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  app.use(express.static(frontendDir, {
    etag:         true,
    lastModified: true,
    setHeaders:   (res, filePath) => {
      const f = filePath.replace(/\\/g, '/');
      // index.html must never be served from cache — belt-and-suspenders
      if (f.endsWith('index.html') || f.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  }));
}

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  if (!frontendDir) return res.status(500).send('Frontend not found');
  // Force browser to always re-fetch index.html so new script versions take effect
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
const runMigrations = require('./migrate');

runMigrations()
  .then(async () => {
    // Attach socket.io to the httpServer (must happen before listen)
    const io = await setupSocket(httpServer);
    // Make io accessible in route handlers via app.get('io')
    app.set('io', io);

    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info('═══════════════════════════════════════');
      logger.info('  IDU Platform v4.1');
      logger.info(`  Port     : ${PORT}`);
      logger.info(`  API      : /api/v1/*`);
      logger.info(`  WebSocket: socket.io enabled`);
      logger.info(`  Redis    : ${process.env.REDIS_URL ? 'configured' : 'in-memory fallback'}`);
      logger.info(`  Email    : ${process.env.RESEND_API_KEY || process.env.SMTP_HOST ? 'configured' : 'dev-log only'}`);
      logger.info(`  Frontend : ${frontendDir || 'NOT FOUND'}`);
      logger.info('═══════════════════════════════════════');
    });
  })
  .catch((err) => {
    logger.error('Startup failed:', err);
    process.exit(1);
  });

module.exports = app;
