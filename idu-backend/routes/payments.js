'use strict';
/**
 * Payment routes — Payme JSONRPC + Click UZ
 *
 * Env vars:
 *   PAYME_MERCHANT_ID   — Payme merchant ID (from merchant cabinet)
 *   PAYME_SECRET_KEY    — Payme test/prod key
 *   CLICK_MERCHANT_ID   — Click merchant ID
 *   CLICK_SERVICE_ID    — Click service ID
 *   CLICK_SECRET_KEY    — Click secret key
 */
'use strict';

const express  = require('express');
const crypto   = require('crypto');
const db       = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ── PAYME JSONRPC ─────────────────────────────────────────────────────────────
// Payme calls our endpoint via HTTPS POST with Basic Auth
// Docs: https://developer.payme.uz/

const PAYME_ID  = process.env.PAYME_MERCHANT_ID  || '';
const PAYME_KEY = process.env.PAYME_SECRET_KEY   || '';

function verifyPaymeAuth(req) {
  const auth = req.headers['authorization'] || '';
  const encoded = auth.replace('Basic ', '');
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const [, key] = decoded.split(':');
  return key === PAYME_KEY;
}

router.post('/payme', async (req, res) => {
  if (!verifyPaymeAuth(req)) {
    return res.json({ error: { code: -32504, message: { ru: 'Недостаточно привилегий', uz: 'Ruxsat yo\'q', en: 'Insufficient privilege' } }, id: req.body?.id });
  }

  const { method, params, id } = req.body || {};

  try {
    switch (method) {
      case 'CheckPerformTransaction':
        return res.json(await paymeCheckPerform(params, id));
      case 'CreateTransaction':
        return res.json(await paymeCreate(params, id));
      case 'PerformTransaction':
        return res.json(await paymePerform(params, id));
      case 'CancelTransaction':
        return res.json(await paymeCancel(params, id));
      case 'CheckTransaction':
        return res.json(await paymeCheck(params, id));
      case 'GetStatement':
        return res.json(await paymeStatement(params, id));
      default:
        return res.json({ error: { code: -32601, message: 'Method not found' }, id });
    }
  } catch (err) {
    return res.json({ error: { code: -31008, message: err.message }, id });
  }
});

async function paymeCheckPerform(params, id) {
  const invoiceId = params?.account?.invoice_id;
  if (!invoiceId) return { error: { code: -31050, message: { uz: 'Invoice ID yo\'q', ru: 'Invoice ID не указан' } }, id };

  const { rows: [invoice] } = await db.query(
    'SELECT * FROM invoices WHERE id=$1 AND status=\'pending\'',
    [invoiceId]
  );
  if (!invoice) return { error: { code: -31050, message: { uz: 'To\'lov topilmadi', ru: 'Счёт не найден' } }, id };
  if (params.amount !== invoice.amount_sum) return { error: { code: -31001, message: { uz: 'Summa noto\'g\'ri', ru: 'Неверная сумма' } }, id };

  return { result: { allow: true }, id };
}

async function paymeCreate(params, id) {
  const invoiceId = params?.account?.invoice_id;
  const txnId     = params?.id;

  const { rows: [existing] } = await db.query(
    'SELECT * FROM payme_transactions WHERE id=$1', [txnId]
  );
  if (existing) {
    if (existing.state !== 1) return { error: { code: -31008, message: 'Transaction in wrong state' }, id };
    return { result: { create_time: existing.create_time, transaction: existing.id, state: 1 }, id };
  }

  const { rows: [invoice] } = await db.query(
    'SELECT * FROM invoices WHERE id=$1 AND status=\'pending\'', [invoiceId]
  );
  if (!invoice) return { error: { code: -31050, message: { uz: 'Invoice topilmadi' } }, id };
  if (params.amount !== invoice.amount_sum) return { error: { code: -31001, message: 'Wrong amount' }, id };

  const now = Date.now();
  await db.query(
    `INSERT INTO payme_transactions (id, invoice_id, state, amount, create_time, raw)
     VALUES ($1,$2,1,$3,$4,$5)`,
    [txnId, invoiceId, params.amount, now, JSON.stringify(params)]
  );
  await db.query(
    'UPDATE invoices SET provider=\'payme\', provider_txn=$1 WHERE id=$2',
    [txnId, invoiceId]
  );

  return { result: { create_time: now, transaction: txnId, state: 1 }, id };
}

async function paymePerform(params, id) {
  const txnId = params?.id;
  const { rows: [txn] } = await db.query('SELECT * FROM payme_transactions WHERE id=$1', [txnId]);

  if (!txn) return { error: { code: -31003, message: 'Transaction not found' }, id };
  if (txn.state === 2) {
    return { result: { perform_time: txn.perform_time, transaction: txnId, state: 2 }, id };
  }
  if (txn.state !== 1) return { error: { code: -31008, message: 'Wrong state' }, id };

  const now = Date.now();
  await db.query(
    'UPDATE payme_transactions SET state=2, perform_time=$1 WHERE id=$2',
    [now, txnId]
  );
  await db.query(
    'UPDATE invoices SET status=\'paid\', paid_at=NOW() WHERE id=$1',
    [txn.invoice_id]
  );

  return { result: { perform_time: now, transaction: txnId, state: 2 }, id };
}

async function paymeCancel(params, id) {
  const txnId = params?.id;
  const { rows: [txn] } = await db.query('SELECT * FROM payme_transactions WHERE id=$1', [txnId]);

  if (!txn) return { error: { code: -31003, message: 'Transaction not found' }, id };
  if (txn.state === -1) {
    return { result: { cancel_time: txn.cancel_time, transaction: txnId, state: -1 }, id };
  }
  if (txn.state === 2) return { error: { code: -31007, message: 'Already completed' }, id };

  const now = Date.now();
  await db.query(
    'UPDATE payme_transactions SET state=-1, cancel_time=$1, reason=$2 WHERE id=$3',
    [now, params?.reason, txnId]
  );
  await db.query(
    'UPDATE invoices SET status=\'cancelled\' WHERE id=$1',
    [txn.invoice_id]
  );

  return { result: { cancel_time: now, transaction: txnId, state: -1 }, id };
}

async function paymeCheck(params, id) {
  const { rows: [txn] } = await db.query(
    'SELECT * FROM payme_transactions WHERE id=$1', [params?.id]
  );
  if (!txn) return { error: { code: -31003, message: 'Transaction not found' }, id };

  return {
    result: {
      create_time:  txn.create_time,
      perform_time: txn.perform_time,
      cancel_time:  txn.cancel_time,
      transaction:  txn.id,
      state:        txn.state,
      reason:       txn.reason,
    },
    id,
  };
}

async function paymeStatement(params, id) {
  const { rows } = await db.query(
    `SELECT * FROM payme_transactions
     WHERE create_time BETWEEN $1 AND $2
     ORDER BY create_time`,
    [params?.from, params?.to]
  );

  return {
    result: {
      transactions: rows.map(t => ({
        id:           t.id,
        time:         t.create_time,
        amount:       t.amount,
        account:      { invoice_id: t.invoice_id },
        create_time:  t.create_time,
        perform_time: t.perform_time,
        cancel_time:  t.cancel_time,
        transaction:  t.id,
        state:        t.state,
        reason:       t.reason,
      })),
    },
    id,
  };
}

// ── CLICK UZ ─────────────────────────────────────────────────────────────────
// Click calls our endpoint for Prepare (action=0) and Complete (action=1)
// Docs: https://docs.click.uz/

const CLICK_MERCHANT = process.env.CLICK_MERCHANT_ID || '';
const CLICK_SERVICE  = process.env.CLICK_SERVICE_ID  || '';
const CLICK_SECRET   = process.env.CLICK_SECRET_KEY  || '';

function verifyClickSign(body, action) {
  const signString = body.click_trans_id + body.service_id + CLICK_SECRET +
    body.merchant_trans_id + (action === 1 ? body.merchant_prepare_id : '') +
    body.amount + body.action + body.sign_time;
  return crypto.createHash('md5').update(signString).digest('hex') === body.sign_string;
}

router.post('/click', async (req, res) => {
  const body = req.body;
  const action = parseInt(body?.action, 10);

  if (!verifyClickSign(body, action)) {
    return res.json({ error: -1, error_note: 'SIGN CHECK FAILED' });
  }

  const invoiceId = body.merchant_trans_id;
  const { rows: [invoice] } = await db.query(
    'SELECT * FROM invoices WHERE id=$1', [invoiceId]
  );
  if (!invoice) return res.json({ error: -5, error_note: 'Invoice not found' });

  if (Math.abs(parseFloat(body.amount) - invoice.amount_sum / 100) > 0.01) {
    return res.json({ error: -2, error_note: 'Incorrect parameter amount' });
  }

  // action=0: Prepare
  if (action === 0) {
    if (invoice.status !== 'pending') return res.json({ error: -4, error_note: 'Already paid or cancelled' });

    const txn = await db.query(
      `INSERT INTO click_transactions
         (click_trans_id, invoice_id, merchant_trans, amount, action, sign_time, sign_string)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [body.click_trans_id, invoice.id, invoiceId, body.amount, 0, body.sign_time, body.sign_string]
    );

    return res.json({
      click_trans_id:   body.click_trans_id,
      merchant_trans_id: invoiceId,
      merchant_prepare_id: txn.rows[0].id,
      error: 0,
      error_note: 'Success',
    });
  }

  // action=1: Complete
  if (action === 1) {
    if (body.error < 0) {
      await db.query('UPDATE invoices SET status=\'cancelled\' WHERE id=$1', [invoice.id]);
      return res.json({ click_trans_id: body.click_trans_id, merchant_trans_id: invoiceId, error: 0, error_note: 'Cancelled' });
    }

    await db.query('UPDATE invoices SET status=\'paid\', paid_at=NOW(), provider=\'click\', provider_txn=$1 WHERE id=$2',
      [body.click_trans_id, invoice.id]
    );
    await db.query(
      `UPDATE click_transactions SET action=1, error=0 WHERE click_trans_id=$1`,
      [body.click_trans_id]
    );

    return res.json({
      click_trans_id:   body.click_trans_id,
      merchant_trans_id: invoiceId,
      merchant_confirm_id: invoice.id,
      error: 0,
      error_note: 'Success',
    });
  }

  res.json({ error: -8, error_note: 'Bad action' });
});

// ── INVOICE CRUD (for app) ────────────────────────────────────────────────────
router.use(authenticate);

// POST /api/payments/invoices — create invoice (dekanat/admin)
router.post('/invoices', authorize('dekanat', 'admin'), async (req, res) => {
  const { student_id, amount_sum, purpose, expires_days = 3 } = req.body;
  if (!student_id || !amount_sum || !purpose) {
    return res.status(400).json({ error: 'student_id, amount_sum, purpose required' });
  }
  const { rows: [inv] } = await db.query(
    `INSERT INTO invoices (student_id, amount_sum, purpose, expires_at, tenant_id)
     VALUES ($1,$2,$3,NOW()+($4||' days')::interval,$5) RETURNING *`,
    [student_id, amount_sum, purpose, expires_days, req.user.tenant_id || null]
  );
  res.json(inv);
});

// GET /api/payments/my — student's own invoices
router.get('/my', async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM invoices WHERE student_id=$1 ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(rows);
});

// GET /api/payments/invoices — dekanat: all invoices
router.get('/invoices', authorize('dekanat', 'admin'), async (req, res) => {
  const { rows } = await db.query(
    `SELECT i.*, u.full_name AS student_name
     FROM invoices i JOIN users u ON u.id=i.student_id
     ORDER BY i.created_at DESC LIMIT 200`
  );
  res.json(rows);
});

// GET /api/payments/payme-link/:invoiceId — generate checkout URL
router.get('/payme-link/:invoiceId', async (req, res) => {
  const { rows: [inv] } = await db.query('SELECT * FROM invoices WHERE id=$1', [req.params.invoiceId]);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });

  // Payme checkout URL: encode merchant ID + params as base64
  const params = `m=${PAYME_ID};ac.invoice_id=${inv.id};a=${inv.amount_sum}`;
  const encoded = Buffer.from(params).toString('base64');
  const url = `https://checkout.paycom.uz/${encoded}`;
  res.json({ url, invoice: inv });
});

module.exports = router;
