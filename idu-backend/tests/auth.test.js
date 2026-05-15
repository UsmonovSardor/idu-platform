'use strict';

/**
 * Auth route integration tests.
 * Uses supertest — does NOT require a running server.
 * DB calls are mocked via jest.mock.
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool:  { connect: jest.fn(), on: jest.fn() },
}));

jest.mock('../migrate', () => jest.fn().mockResolvedValue());

process.env.JWT_SECRET  = 'test-secret-that-is-long-enough-32chars';
process.env.DATABASE_URL = 'postgres://test';
process.env.NODE_ENV    = 'test';

const request = require('supertest');
const bcrypt  = require('bcryptjs');
const db      = require('../config/database');
const app     = require('../server');

const HASH = bcrypt.hashSync('Password1', 10);

const MOCK_USER = {
  id:            1,
  full_name:     'Test User',
  login:         'testuser',
  password_hash: HASH,
  role:          'student',
  is_active:     true,
};

beforeEach(() => jest.clearAllMocks());

// ── POST /api/v1/auth/login ───────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('returns 200 + token on valid credentials', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [MOCK_USER] }) // user lookup
      .mockResolvedValueOnce({ rows: [] });          // last_login update

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: 'testuser', password: 'Password1' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('student');
    // httpOnly cookie must be set
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toMatch(/idu_token/);
  });

  it('returns 401 on wrong password', async () => {
    db.query.mockResolvedValueOnce({ rows: [MOCK_USER] });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: 'testuser', password: 'WrongPass1' });

    expect(res.status).toBe(401);
  });

  it('returns 401 on unknown user', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: 'nobody', password: 'Password1' });

    expect(res.status).toBe(401);
  });

  it('returns 422 on missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});

    expect(res.status).toBe(422);
  });
});

// ── POST /api/v1/auth/logout ──────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('clears the cookie and returns 200', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    // Cookie cleared (maxAge=0 or expires in the past)
    const cookie = (res.headers['set-cookie'] || []).join('');
    expect(cookie).toMatch(/idu_token/);
  });
});

// ── GET /api/v1/auth/me ───────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

// ── GET /health ────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
