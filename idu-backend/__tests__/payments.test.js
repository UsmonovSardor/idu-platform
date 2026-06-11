'use strict';

const request = require('supertest');

process.env.NODE_ENV     = 'test';
process.env.JWT_SECRET   = 'test_secret_not_for_prod_1234567890';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://idu:idu_test@localhost:5432/idu_test';
process.env.PAYME_SECRET_KEY = 'test_payme_key';

const app = require('../server');

describe('POST /api/v1/payments/payme', () => {
  it('returns Payme auth error for wrong credentials', async () => {
    const res = await request(app)
      .post('/api/v1/payments/payme')
      .set('Authorization', 'Basic ' + Buffer.from('Paycom:wrong_key').toString('base64'))
      .send({ method: 'CheckPerformTransaction', params: { account: { invoice_id: 1 }, amount: 10000 }, id: 1 });
    expect(res.status).toBe(200);
    expect(res.body.error).toBeTruthy();
    expect(res.body.error.code).toBe(-32504);
  });

  it('rejects unknown method', async () => {
    const res = await request(app)
      .post('/api/v1/payments/payme')
      .set('Authorization', 'Basic ' + Buffer.from('Paycom:test_payme_key').toString('base64'))
      .send({ method: 'UnknownMethod', params: {}, id: 99 });
    expect(res.status).toBe(200);
    expect(res.body.error.code).toBe(-32601);
  });
});

describe('POST /api/v1/payments/click', () => {
  it('returns sign check failed for bad signature', async () => {
    const res = await request(app)
      .post('/api/v1/payments/click')
      .send({
        click_trans_id: '123',
        service_id: '456',
        merchant_trans_id: '1',
        amount: '100',
        action: '0',
        sign_time: '2026-01-01 00:00:00',
        sign_string: 'bad_signature',
        error: '0',
        error_note: 'Success',
      });
    expect(res.status).toBe(200);
    expect(res.body.error).toBe(-1);
  });
});

describe('GET /api/v1/payments/my', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/payments/my');
    expect(res.status).toBe(401);
  });
});
