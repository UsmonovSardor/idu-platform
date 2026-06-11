'use strict';

const request = require('supertest');
const jwt     = require('jsonwebtoken');

process.env.NODE_ENV     = 'test';
process.env.JWT_SECRET   = 'test_secret_not_for_prod_1234567890';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://idu:idu_test@localhost:5432/idu_test';

const app = require('../server');

const SECRET = process.env.JWT_SECRET;

function makeToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '1h' });
}

describe('Tenant isolation', () => {
  it('GET /api/v1/students returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/students');
    expect(res.status).toBe(401);
  });

  it('student role cannot access /students list', async () => {
    const token = makeToken({ sub: 999, role: 'student' });
    const res = await request(app)
      .get('/api/v1/students')
      .set('Cookie', `idu_token=${token}`);
    expect(res.status).toBe(403);
  });

  it('student cannot access another students grades', async () => {
    const token = makeToken({ sub: 1, role: 'student' });
    const res = await request(app)
      .get('/api/v1/students/999/grades')
      .set('Cookie', `idu_token=${token}`);
    expect(res.status).toBe(403);
  });
});

describe('Document verification', () => {
  it('GET /api/documents/verify requires token param', async () => {
    const res = await request(app).get('/api/documents/verify');
    expect(res.status).toBe(400);
    expect(res.body.valid).toBe(false);
  });

  it('GET /api/documents/verify rejects tampered token', async () => {
    const res = await request(app)
      .get('/api/documents/verify?token=tampered.token.value');
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it('GET /api/documents/verify accepts valid doc token', async () => {
    const validToken = jwt.sign(
      { type: 'doc', doc_id: 'IDU-TR-1-123456', doc_type: 'transcript', student: 'Test User' },
      SECRET,
      { expiresIn: '10y' }
    );
    const res = await request(app)
      .get(`/api/documents/verify?token=${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.student).toBe('Test User');
  });
});
