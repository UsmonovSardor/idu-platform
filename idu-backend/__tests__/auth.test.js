'use strict';

const request = require('supertest');

// Set test env before requiring app
process.env.NODE_ENV    = 'test';
process.env.JWT_SECRET  = 'test_secret_not_for_prod_1234567890';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://idu:idu_test@localhost:5432/idu_test';

const app = require('../server');

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('rejects missing body with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects short password with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: 'testuser', password: '' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for nonexistent user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: 'nonexistent_user_xyz', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBeTruthy();
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('returns 401 without refresh cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
