-- =============================================================================
-- 026_payments.sql
-- Payment infrastructure for Payme / Click UZ integration.
-- =============================================================================

-- Invoice: the "bill" we send to a student
CREATE TABLE IF NOT EXISTS invoices (
  id            BIGSERIAL    PRIMARY KEY,
  student_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  tenant_id     INTEGER      REFERENCES tenants(id) ON DELETE SET NULL,
  amount_sum    BIGINT       NOT NULL,         -- amount in UZS tiyin (x100 for sums)
  currency      CHAR(3)      NOT NULL DEFAULT 'UZS',
  purpose       TEXT         NOT NULL,         -- "Tuition 2024-2025 semester 1"
  status        TEXT         NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','paid','cancelled','expired','refunded')),
  provider      TEXT         CHECK (provider IN ('payme','click','transfer','manual')),
  provider_txn  TEXT,                          -- Payme/Click transaction ID
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  paid_at       TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '3 days'),
  meta          JSONB        DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices(student_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_txn ON invoices(provider_txn) WHERE provider_txn IS NOT NULL;

-- Payme transactions (raw log from Payme JSONRPC callbacks)
CREATE TABLE IF NOT EXISTS payme_transactions (
  id            TEXT         PRIMARY KEY,     -- Payme's _id
  invoice_id    BIGINT       REFERENCES invoices(id) ON DELETE SET NULL,
  state         INTEGER      NOT NULL,         -- 1=created, 2=completed, -1=cancelled
  amount        BIGINT       NOT NULL,
  create_time   BIGINT,                        -- Payme timestamp (ms)
  perform_time  BIGINT,
  cancel_time   BIGINT,
  reason        INTEGER,                       -- cancellation reason code
  raw           JSONB        DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Click transactions (raw log from Click callbacks)
CREATE TABLE IF NOT EXISTS click_transactions (
  id              BIGSERIAL    PRIMARY KEY,
  click_trans_id  TEXT         NOT NULL,
  invoice_id      BIGINT       REFERENCES invoices(id) ON DELETE SET NULL,
  merchant_trans  TEXT,                        -- our invoice ID
  amount          NUMERIC(12,2) NOT NULL,
  action          INTEGER,                     -- 0=prepare, 1=complete
  sign_time       TEXT,
  sign_string     TEXT,
  error           INTEGER,
  error_note      TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_click_txn ON click_transactions(click_trans_id);
