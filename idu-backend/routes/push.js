'use strict';
/**
 * Push Notifications — Web Push API
 * Endpoints:
 *   GET  /push/vapid-public        → returns public VAPID key (no auth needed)
 *   POST /push/subscribe           → save subscription
 *   POST /push/unsubscribe         → remove subscription
 *   POST /push/test                → send test notification (auth required)
 *   POST /push/send-to-user        → admin: send to specific user
 */

const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { logger } = require('../middleware/logger');
const db = require('../config/database');

const router = express.Router();

// Lazy-load web-push only if VAPID keys are configured
let webpush = null;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@idu.uz';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush = require('web-push');
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    logger.info('Push notifications: VAPID configured');
  } catch (e) {
    logger.warn('web-push not installed: npm i web-push');
  }
} else {
  logger.info('Push notifications: VAPID keys not configured (dev mode)');
}

// ── GET /vapid-public ─────────────────────────────────────────────────────────
router.get('/vapid-public', (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC, configured: !!webpush });
});

// ── POST /subscribe ───────────────────────────────────────────────────────────
router.post(
  '/subscribe',
  authenticate,
  [
    body('endpoint').isString().isLength({ min: 10, max: 2000 }),
    body('keys.p256dh').isString().isLength({ min: 10, max: 200 }),
    body('keys.auth').isString().isLength({ min: 5, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const { endpoint, keys } = req.body;
    const ua = (req.headers['user-agent'] || '').substring(0, 250);
    await db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, endpoint) DO UPDATE
         SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, last_used = NOW()`,
      [req.user.id, endpoint, keys.p256dh, keys.auth, ua]
    );
    res.json({ ok: true });
  }
);

// ── POST /unsubscribe ─────────────────────────────────────────────────────────
router.post('/unsubscribe', authenticate, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  await db.query(
    'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
    [req.user.id, endpoint]
  );
  res.json({ ok: true });
});

// ── Send helper (internal — called from other routes) ─────────────────────────
async function sendPushToUser(userId, payload) {
  if (!webpush) return { sent: 0, reason: 'web-push not configured' };
  const { rows } = await db.query(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );
  let sent = 0;
  const dead = [];
  await Promise.all(rows.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.id);
    }
  }));
  if (dead.length) {
    await db.query(`DELETE FROM push_subscriptions WHERE id = ANY($1::int[])`, [dead]);
  }
  return { sent, removed: dead.length };
}

router.sendPushToUser = sendPushToUser;

// ── POST /test ────────────────────────────────────────────────────────────────
router.post('/test', authenticate, async (req, res) => {
  const result = await sendPushToUser(req.user.id, {
    title: '🔔 IDU Test Bildirishnoma',
    body: 'Push notifikatsiyalar muvaffaqiyatli ulandi!',
    icon: '/manifest.json',
    url: '/',
  });
  res.json(result);
});

// ── POST /send-to-user (admin/dekanat only) ───────────────────────────────────
router.post(
  '/send-to-user',
  authenticate,
  authorize('admin', 'dekanat'),
  [
    body('userId').isInt(),
    body('title').isString().isLength({ min: 1, max: 100 }),
    body('body').isString().isLength({ min: 1, max: 300 }),
  ],
  validate,
  async (req, res) => {
    const result = await sendPushToUser(req.body.userId, {
      title: req.body.title,
      body:  req.body.body,
      url:   req.body.url || '/',
    });
    res.json(result);
  }
);

module.exports = router;
