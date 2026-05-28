#!/usr/bin/env node
/**
 * Generate VAPID keys for web push.
 * Usage:  node scripts/gen-vapid.js
 * Then copy the printed values into .env as VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
 */
'use strict';

try {
  const webpush = require('web-push');
  const keys = webpush.generateVAPIDKeys();
  console.log('');
  console.log('Add these to your .env file:');
  console.log('───────────────────────────────────────────');
  console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
  console.log(`VAPID_SUBJECT=mailto:admin@idu.uz`);
  console.log('───────────────────────────────────────────');
} catch (e) {
  console.error('web-push not installed. Run: npm install web-push');
  process.exit(1);
}
