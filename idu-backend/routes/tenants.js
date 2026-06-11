'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const db                   = require('../config/database');
const validate             = require('../middleware/validate');
const { authenticate, authorize, invalidateUserCache } = require('../middleware/auth');
const { invalidateTenantCache } = require('../middleware/tenant');
const redis                = require('../services/redis');

const router = express.Router();

// ── GET /api/v1/tenants/config ─────────────────────────────────────────────────
// Public — returns branding config for the current subdomain.
// Used by the frontend on startup to apply custom logo/colors.
router.get('/config', async (req, res) => {
  // req.tenant is set by resolveTenant middleware in server.js
  const t = req.tenant;
  if (!t) return res.json({ slug: 'idu', name: 'IDU', primary_color: '#1e3a8a' });

  res.json({
    id:              t.id,
    slug:            t.slug,
    name:            t.name,
    logo_url:        t.logo_url   || null,
    primary_color:   t.primary_color   || '#1e3a8a',
    secondary_color: t.secondary_color || '#2563eb',
    settings:        t.settings   || {},
  });
});

// ── GET /api/v1/tenants — list all (super-admin only) ─────────────────────────
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, slug, name, domain, logo_url, primary_color, secondary_color,
            is_active, created_at,
            (SELECT COUNT(*) FROM users u WHERE u.tenant_id = tenants.id) AS user_count
     FROM tenants ORDER BY created_at DESC`
  );
  res.json(rows);
});

// ── POST /api/v1/tenants — create new tenant ──────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('slug').trim().isLength({ min: 2, max: 50 }).matches(/^[a-z0-9-]+$/)
      .withMessage('slug: lowercase letters, digits and hyphens only'),
    body('name').trim().isLength({ min: 2, max: 200 }),
    body('domain').optional().trim().isLength({ max: 200 }),
    body('primaryColor').optional().trim().matches(/^#[0-9a-fA-F]{6}$/),
    body('secondaryColor').optional().trim().matches(/^#[0-9a-fA-F]{6}$/),
    body('logoUrl').optional().trim().isURL(),
  ],
  validate,
  async (req, res) => {
    const { slug, name, domain, primaryColor, secondaryColor, logoUrl } = req.body;

    const { rows } = await db.query(
      `INSERT INTO tenants (slug, name, domain, primary_color, secondary_color, logo_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        slug,
        name,
        domain  || null,
        primaryColor   || '#1e3a8a',
        secondaryColor || '#2563eb',
        logoUrl || null,
      ]
    );
    res.status(201).json(rows[0]);
  }
);

// ── PATCH /api/v1/tenants/:id — update branding ───────────────────────────────
router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('name').optional().trim().isLength({ min: 2, max: 200 }),
    body('domain').optional().trim().isLength({ max: 200 }),
    body('primaryColor').optional().trim().matches(/^#[0-9a-fA-F]{6}$/),
    body('secondaryColor').optional().trim().matches(/^#[0-9a-fA-F]{6}$/),
    body('logoUrl').optional().trim().isURL(),
    body('isActive').optional().isBoolean().toBoolean(),
    body('settings').optional().isObject(),
  ],
  validate,
  async (req, res) => {
    const { name, domain, primaryColor, secondaryColor, logoUrl, isActive, settings } = req.body;
    const { id } = req.params;

    const updates = [];
    const params  = [];

    if (name !== undefined)           { params.push(name);           updates.push(`name = $${params.length}`); }
    if (domain !== undefined)         { params.push(domain || null); updates.push(`domain = $${params.length}`); }
    if (primaryColor !== undefined)   { params.push(primaryColor);   updates.push(`primary_color = $${params.length}`); }
    if (secondaryColor !== undefined) { params.push(secondaryColor); updates.push(`secondary_color = $${params.length}`); }
    if (logoUrl !== undefined)        { params.push(logoUrl || null); updates.push(`logo_url = $${params.length}`); }
    if (isActive !== undefined)       { params.push(isActive);       updates.push(`is_active = $${params.length}`); }
    if (settings !== undefined)       { params.push(JSON.stringify(settings)); updates.push(`settings = $${params.length}`); }

    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

    params.push(id);
    updates.push(`updated_at = NOW()`);

    const { rows } = await db.query(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });

    await invalidateTenantCache(rows[0].slug);
    res.json(rows[0]);
  }
);

// ── POST /api/v1/tenants/:id/users — add user to a tenant ─────────────────────
router.post(
  '/:id/users',
  authenticate,
  authorize('admin'),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('userId').isInt({ min: 1 }).toInt(),
  ],
  validate,
  async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;

    await db.query('UPDATE users SET tenant_id = $1 WHERE id = $2', [id, userId]);
    await invalidateUserCache(userId);
    res.json({ message: 'User assigned to tenant' });
  }
);

module.exports = router;
