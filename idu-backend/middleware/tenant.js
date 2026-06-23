'use strict';

const db    = require('../config/database');
const redis = require('../services/redis');

const TENANT_CACHE_TTL = 3600; // 1 hour

/**
 * Resolve the current tenant from the subdomain or custom domain.
 *
 * ttu.idu.uz        → slug = 'ttu'
 * idu.uz            → slug = 'idu'
 * custom.domain.com → matched by full hostname against tenants.domain column
 *
 * Sets req.tenant = { id, slug, name, logo_url, primary_color, ... }
 * Falls back to the default tenant if hostname is the root Railway domain.
 */
async function resolveTenant(req, res, next) {
  const host = (req.hostname || '').toLowerCase();

  // Derive slug: first subdomain segment, or 'idu' for root domain
  const parts = host.split('.');
  const slug  = parts.length >= 3 ? parts[0] : 'idu';

  const cacheKey = `tenant:${slug}:${host}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      req.tenant = JSON.parse(cached);
      return next();
    }

    const { rows } = await db.query(
      `SELECT id, slug, name, logo_url, primary_color, secondary_color,
              domain, is_active, settings
       FROM tenants
       WHERE (slug = $1 OR domain = $2) AND is_active = TRUE
       LIMIT 1`,
      [slug, host]
    );

    if (!rows.length) {
      // Unknown subdomain — try default tenant so existing deploys keep working
      const { rows: def } = await db.query(
        `SELECT id, slug, name, logo_url, primary_color, secondary_color,
                domain, is_active, settings
         FROM tenants WHERE slug = 'idu' AND is_active = TRUE LIMIT 1`
      );
      if (!def.length) {
        return res.status(404).json({ error: 'Platform not found' });
      }
      req.tenant = def[0];
    } else {
      req.tenant = rows[0];
    }

    await redis.set(cacheKey, JSON.stringify(req.tenant), 'EX', TENANT_CACHE_TTL);
    next();
  } catch (err) {
    next(err);
  }
}

// Bust tenant cache (call after updating tenant config)
// Uses SCAN instead of KEYS to avoid blocking Redis on large keyspaces.
async function invalidateTenantCache(slug) {
  try {
    const client = await redis.getClient();
    let keys = [];
    if (typeof client.scan === 'function') {
      let cursor = '0';
      do {
        const [next, batch] = await client.scan(cursor, 'MATCH', `tenant:${slug}:*`, 'COUNT', 100);
        cursor = next;
        keys.push(...batch);
      } while (cursor !== '0');
    } else if (typeof client.keys === 'function') {
      // in-memory fallback — safe because it's not a real Redis instance
      keys = await client.keys(`tenant:${slug}:*`);
    }
    if (keys.length) await redis.del(...keys).catch(() => {});
  } catch (_) {}
}

module.exports = { resolveTenant, invalidateTenantCache };
