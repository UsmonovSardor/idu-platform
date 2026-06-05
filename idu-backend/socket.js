'use strict';
/**
 * IDU Real-time Chat — Socket.io v4
 *
 * Architecture:
 *  • Auth via JWT cookie or Bearer token on handshake
 *  • Rooms mirror the chat_rooms table (socket.io room = `room:{id}`)
 *  • Messages persisted to DB, then broadcast via socket.io
 *  • Redis adapter supported automatically when REDIS_URL is set
 *    (required for multi-instance horizontal scaling)
 *  • SSE endpoint in messages.js kept as fallback for clients
 *    that can't use WebSocket (proxies, etc.)
 */

const { Server }  = require('socket.io');
const jwt         = require('jsonwebtoken');
const db          = require('./config/database');
const { logger }  = require('./middleware/logger');
const { registerBattle } = require('./services/battle');

const JWT_SECRET  = process.env.JWT_SECRET;
const IS_PROD     = process.env.NODE_ENV === 'production';

// Per-user per-room message rate limit: max 10 messages per 10 seconds
const _msgRateMap = new Map(); // `${userId}:${roomId}` → { count, resetAt }
function checkMsgRate(userId, roomId) {
  const key = `${userId}:${roomId}`;
  const now = Date.now();
  const bucket = _msgRateMap.get(key);
  if (!bucket || now > bucket.resetAt) {
    _msgRateMap.set(key, { count: 1, resetAt: now + 10000 });
    return true;
  }
  if (bucket.count >= 10) return false;
  bucket.count++;
  return true;
}

// ── Auth middleware ────────────────────────────────────────────────────────────
async function socketAuth(socket, next) {
  try {
    // 1. Try cookie (primary for same-origin)
    const cookies = socket.handshake.headers.cookie || '';
    const cookieMatch = cookies.match(/idu_token=([^;]+)/);
    let token = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;

    // 2. Fallback: Bearer header
    if (!token) {
      const auth = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      if (auth) token = auth.replace(/^Bearer\s+/i, '');
    }

    if (!token) return next(new Error('Authentication required'));

    const payload = jwt.verify(token, JWT_SECRET);

    // Load user from DB (confirms still active)
    const { rows } = await db.query(
      'SELECT id, full_name, login, role FROM users WHERE id=$1 AND is_active=TRUE LIMIT 1',
      [payload.sub]
    );
    if (!rows[0]) return next(new Error('User not found'));

    socket.user = rows[0];
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
}

// ── Setup socket.io ────────────────────────────────────────────────────────────
async function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const allowed = new Set([
          'http://localhost:3000',
          'http://localhost:5500',
          'http://127.0.0.1:5500',
        ]);
        if (allowed.has(origin) || /\.railway\.app$/.test(origin)) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
    pingTimeout:  20000,
    pingInterval: 25000,
    // Allow long-polling fallback for environments that block WebSocket
    transports: IS_PROD ? ['websocket', 'polling'] : ['websocket', 'polling'],
  });

  // ── Optional: Redis adapter for multi-instance ────────────────────────────
  if (process.env.REDIS_URL) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const redis = require('./services/redis');
      const [pub, sub] = await Promise.all([redis.getPub(), redis.getSub()]);
      if (pub && sub) {
        io.adapter(createAdapter(pub, sub));
        logger.info('[socket.io] Redis adapter enabled');
      }
    } catch (e) {
      logger.warn('[socket.io] Redis adapter not available: %s', e.message);
    }
  }

  io.use(socketAuth);

  // ── Presence tracking ──────────────────────────────────────────────────────
  // Map<userId, connectionCount> so multiple tabs don't flip a user offline early.
  const onlineCounts = new Map();
  io._onlineUsers = new Set(); // read by messages.js /presence endpoint

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const user = socket.user;
    logger.info('[socket.io] connected uid=%d role=%s', user.id, user.role);

    // Mark online (broadcast only on first connection for this user)
    const prev = onlineCounts.get(user.id) || 0;
    onlineCounts.set(user.id, prev + 1);
    io._onlineUsers.add(user.id);
    if (prev === 0) {
      io.emit('presence:update', { userId: user.id, online: true });
    }
    db.query('UPDATE users SET last_seen=NOW() WHERE id=$1', [user.id]).catch(() => {});

    // Auto-join all rooms the user is a member of
    try {
      const { rows: rooms } = await db.query(
        'SELECT room_id FROM chat_room_members WHERE user_id=$1', [user.id]
      );
      for (const r of rooms) socket.join(`room:${r.room_id}`);
    } catch (e) {
      logger.warn('[socket.io] auto-join rooms failed: %s', e.message);
    }

    // ── join:room — join/verify a specific room ──────────────────────────────
    socket.on('join:room', async (roomId, ack) => {
      roomId = parseInt(roomId, 10);
      if (isNaN(roomId)) return ack?.({ error: 'Invalid roomId' });
      try {
        const { rowCount } = await db.query(
          'SELECT 1 FROM chat_room_members WHERE room_id=$1 AND user_id=$2',
          [roomId, user.id]
        );
        if (!rowCount) return ack?.({ error: 'Access denied' });
        socket.join(`room:${roomId}`);
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ error: 'Server error' });
      }
    });

    // ── chat:message — send a message ────────────────────────────────────────
    socket.on('chat:message', async ({ roomId, content }, ack) => {
      roomId  = parseInt(roomId, 10);
      content = String(content || '').trim();

      if (isNaN(roomId) || !content || content.length > 2000) {
        return ack?.({ error: 'Invalid message' });
      }
      if (!checkMsgRate(user.id, roomId)) {
        return ack?.({ error: 'Juda tez yuboryapsiz. Biroz kuting.' });
      }

      try {
        // Verify membership
        const { rowCount } = await db.query(
          'SELECT 1 FROM chat_room_members WHERE room_id=$1 AND user_id=$2',
          [roomId, user.id]
        );
        if (!rowCount) return ack?.({ error: 'Access denied' });

        // Persist to DB
        const { rows } = await db.query(
          `INSERT INTO chat_messages (room_id, sender_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, content, created_at`,
          [roomId, user.id, content]
        );

        const msg = {
          ...rows[0],
          sender_id:   user.id,
          sender_name: user.full_name,
          sender_role: user.role,
        };

        // Broadcast to everyone in the room (including sender)
        io.to(`room:${roomId}`).emit('chat:message', msg);
        ack?.({ ok: true, message: msg });
      } catch (e) {
        logger.error('[socket.io] chat:message error: %s', e.message);
        ack?.({ error: 'Server error' });
      }
    });

    // ── chat:typing — typing indicator ───────────────────────────────────────
    socket.on('chat:typing', ({ roomId, isTyping }) => {
      roomId = parseInt(roomId, 10);
      if (isNaN(roomId)) return;
      socket.to(`room:${roomId}`).emit('chat:typing', {
        userId:     user.id,
        userName:   user.full_name,
        isTyping:   !!isTyping,
      });
    });

    // ── IDU Liga — live quiz battle handlers ─────────────────────────────────
    try { registerBattle(io, socket, user); }
    catch (e) { logger.warn('[socket.io] battle register failed: %s', e.message); }

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info('[socket.io] disconnect uid=%d reason=%s', user.id, reason);
      const n = (onlineCounts.get(user.id) || 1) - 1;
      if (n <= 0) {
        onlineCounts.delete(user.id);
        io._onlineUsers.delete(user.id);
        io.emit('presence:update', { userId: user.id, online: false, last_seen: new Date().toISOString() });
        db.query('UPDATE users SET last_seen=NOW() WHERE id=$1', [user.id]).catch(() => {});
      } else {
        onlineCounts.set(user.id, n);
      }
    });
  });

  // Expose broadcast helper for REST routes (messages.js can call this)
  io._broadcastToRoom = (roomId, eventName, payload) => {
    io.to(`room:${roomId}`).emit(eventName, payload);
  };

  logger.info('[socket.io] server ready');
  return io;
}

module.exports = { setupSocket };
