'use strict';
// IDU — audit log middleware
// Logs every authenticated mutation to the audit_log table.
// Fire-and-forget (does not block the response).

const db = require('../config/database');
const { realIp } = require('./security');

const ACTION_MAP = {
  'POST   /api/v1/auth/login':            { action: 'LOGIN',          entity: 'user',       skipBody: true },
  'POST   /api/v1/auth/logout':           { action: 'LOGOUT',         entity: 'user' },
  'POST   /api/v1/auth/change-password':  { action: 'CHANGE_PASSWORD', entity: 'user',      skipBody: true },
  'POST   /api/v1/students':              { action: 'CREATE_USER',    entity: 'user' },
  'PUT    /api/v1/students/:id':          { action: 'UPDATE_USER',    entity: 'user' },
  'DELETE /api/v1/students/:id':          { action: 'DELETE_USER',    entity: 'user' },
  'POST   /api/v1/grades':                { action: 'CREATE_GRADE',   entity: 'grade' },
  'PUT    /api/v1/grades/:id':            { action: 'UPDATE_GRADE',   entity: 'grade' },
  'DELETE /api/v1/grades/:id':            { action: 'DELETE_GRADE',   entity: 'grade' },
  'POST   /api/v1/questions/upload-pdf':  { action: 'UPLOAD_QUESTIONS', entity: 'question' },
  'POST   /api/v1/questions':             { action: 'CREATE_QUESTION', entity: 'question' },
  'DELETE /api/v1/questions/:id':         { action: 'DELETE_QUESTION', entity: 'question' },
  'POST   /api/v1/teacher-exams':         { action: 'CREATE_EXAM',    entity: 'exam' },
  'PUT    /api/v1/teacher-exams/:id':     { action: 'UPDATE_EXAM',    entity: 'exam' },
  'DELETE /api/v1/teacher-exams/:id':     { action: 'DELETE_EXAM',    entity: 'exam' },
  'POST   /api/v1/teacher-exams/:id/submit':    { action: 'SUBMIT_EXAM',     entity: 'exam' },
  'POST   /api/v1/teacher-exams/:id/cheat-warn':{ action: 'CHEAT_DETECTED',  entity: 'exam' },
  'POST   /api/v1/attendance/session':    { action: 'OPEN_ATTENDANCE',     entity: 'attendance' },
  'POST   /api/v1/attendance/mark':       { action: 'MARK_ATTENDANCE',     entity: 'attendance' },
  'GET    /api/v1/documents/transcript/:id':  { action: 'DOWNLOAD_TRANSCRIPT', entity: 'document' },
  'GET    /api/v1/documents/certificate/:id': { action: 'DOWNLOAD_CERTIFICATE', entity: 'document' },
};

function matchRoute(method, path) {
  // Normalize: convert /api/123 → /api/:id pattern
  const normalized = path.replace(/\/\d+/g, '/:id');
  const v1Key = `${method.padEnd(6)} ${normalized.replace(/^\/api(?!\/v1)/, '/api/v1')}`;
  return ACTION_MAP[v1Key] || ACTION_MAP[`${method.padEnd(6)} ${normalized}`] || null;
}

// Express middleware factory
function audit() {
  return (req, res, next) => {
    // Hook into res.end to capture status code
    const origEnd = res.end;
    res.end = function (chunk, encoding) {
      res.end = origEnd;
      res.end(chunk, encoding);

      // Decide if we log
      const map = matchRoute(req.method, req.path);
      if (!map) return; // Not a tracked action

      const status = res.statusCode < 400 ? 'success'
                   : res.statusCode === 401 || res.statusCode === 403 ? 'blocked'
                   : 'failed';

      const details = {};
      if (req.params && req.params.id) details.target_id = req.params.id;
      if (req.body && !map.skipBody) {
        // Strip sensitive fields
        const safe = { ...req.body };
        ['password', 'newPassword', 'oldPassword', 'token', 'refresh_token'].forEach(k => delete safe[k]);
        if (Object.keys(safe).length) details.body = safe;
      }

      // Fire and forget — never block response
      db.query(
        `INSERT INTO audit_log
           (user_id, user_login, user_role, action, entity, entity_id,
            ip_address, user_agent, details, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          req.user ? req.user.id : null,
          req.user ? req.user.login : (req.body && req.body.login) || null,
          req.user ? req.user.role : null,
          map.action,
          map.entity,
          req.params && req.params.id ? parseInt(req.params.id, 10) || null : null,
          realIp(req) || null,
          (req.headers['user-agent'] || '').substring(0, 500),
          details,
          status
        ]
      ).catch(() => {}); // Never let audit failure break the request
    };
    next();
  };
}

// Manual log helper (for actions that don't fit the middleware pattern)
async function logEvent(req, action, entity, entityId, details, status) {
  try {
    await db.query(
      `INSERT INTO audit_log
         (user_id, user_login, user_role, action, entity, entity_id,
          ip_address, user_agent, details, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        req.user ? req.user.id : null,
        req.user ? req.user.login : null,
        req.user ? req.user.role : null,
        action, entity, entityId || null,
        req.ip || req.headers['x-forwarded-for'] || null,
        (req.headers['user-agent'] || '').substring(0, 500),
        details || {}, status || 'success'
      ]
    );
  } catch (e) { /* swallow */ }
}

module.exports = { audit, logEvent };
