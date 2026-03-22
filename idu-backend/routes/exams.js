'use strict';

const express  = require('express');
const { body, param, query } = require('express-validator');

const db                    = require('../config/database');
const validate              = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const VALID_SUBJECTS  = ['algo', 'ai', 'math', 'db', 'web'];
const VALID_EXAM_TYPES = ['test', 'sesiya'];
