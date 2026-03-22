'use strict';

const { validationResult } = require('express-validator');

/**
 * Collect express-validator errors and return 422 if any exist.
 * Place this AFTER the validation chain in route handlers:
 *
 *   router.post('/login', [...validationRules], validate, handler)
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error:  'Validation failed',
      fields: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

module.exports = validate;
