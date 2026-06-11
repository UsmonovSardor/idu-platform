-- =============================================================================
-- 023_multi_tenancy.sql
-- Each university gets its own tenant record and subdomain.
-- All user-owned data is scoped by tenant_id.
-- Existing data is assigned to the default 'idu' tenant.
-- =============================================================================

-- ── Tenants table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id              SERIAL PRIMARY KEY,
  slug            VARCHAR(50)  NOT NULL UNIQUE,   -- subdomain key: ttu, nuu, tdtu …
  name            VARCHAR(200) NOT NULL,
  domain          VARCHAR(200),                    -- optional custom domain
  logo_url        TEXT,
  primary_color   VARCHAR(7)   NOT NULL DEFAULT '#1e3a8a',
  secondary_color VARCHAR(7)   NOT NULL DEFAULT '#2563eb',
  settings        JSONB        NOT NULL DEFAULT '{}',
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_domain
  ON tenants (domain) WHERE domain IS NOT NULL;

-- Default tenant for the original IDU deployment
INSERT INTO tenants (slug, name, primary_color, secondary_color)
VALUES ('idu', 'IDU — International Digital University', '#1e3a8a', '#2563eb')
ON CONFLICT (slug) DO NOTHING;

-- ── Add tenant_id to core tables ──────────────────────────────────────────────
ALTER TABLE users    ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id);
ALTER TABLE courses  ADD COLUMN IF NOT EXISTS tenant_id INT REFERENCES tenants(id);

-- ── Back-fill: assign all existing rows to the default tenant ─────────────────
UPDATE users   SET tenant_id = (SELECT id FROM tenants WHERE slug = 'idu') WHERE tenant_id IS NULL;
UPDATE courses SET tenant_id = (SELECT id FROM tenants WHERE slug = 'idu') WHERE tenant_id IS NULL;

-- ── Indexes for tenant-scoped queries ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_tenant    ON users   (tenant_id);
CREATE INDEX IF NOT EXISTS idx_courses_tenant  ON courses (tenant_id);

-- ── Tenant admin roles table ──────────────────────────────────────────────────
-- Tracks which user is the "super-admin" for a given tenant
CREATE TABLE IF NOT EXISTS tenant_admins (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

-- ── Tenant invite tokens (for onboarding new universities) ────────────────────
CREATE TABLE IF NOT EXISTS tenant_invites (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token      VARCHAR(64) NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  email      VARCHAR(150),
  role       VARCHAR(20) NOT NULL DEFAULT 'admin',
  used       BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
