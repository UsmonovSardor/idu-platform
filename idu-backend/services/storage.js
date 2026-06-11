'use strict';
/**
 * Cloud file storage service — Cloudflare R2 (S3-compatible).
 * Falls back to local disk when CF_* env vars are not set (dev/test).
 *
 * Environment variables:
 *   CF_ACCOUNT_ID   — Cloudflare account ID
 *   CF_ACCESS_KEY   — R2 Access Key ID
 *   CF_SECRET_KEY   — R2 Secret Access Key
 *   CF_BUCKET       — R2 bucket name (default: idu-uploads)
 *   CF_PUBLIC_URL   — Public CDN URL for the bucket (e.g. https://cdn.idu.uz)
 *
 * Usage:
 *   const { uploadFile, deleteFile, getFileUrl } = require('../services/storage');
 *   const url = await uploadFile(buffer, 'avatars/user_1.jpg', 'image/jpeg');
 */

const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const USE_S3 = !!(process.env.CF_ACCOUNT_ID && process.env.CF_ACCESS_KEY);

let s3Client = null;

if (USE_S3) {
  const { S3Client } = require('@aws-sdk/client-s3');
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.CF_ACCESS_KEY,
      secretAccessKey: process.env.CF_SECRET_KEY,
    },
  });
}

const BUCKET     = process.env.CF_BUCKET      || 'idu-uploads';
const PUBLIC_URL = process.env.CF_PUBLIC_URL  || '';
const LOCAL_DIR  = process.env.UPLOAD_DIR     || './uploads';

/**
 * Upload a file buffer to R2 (or local disk in dev).
 * @param {Buffer} buffer
 * @param {string} key       — e.g. "avatars/user_1.webp"
 * @param {string} mimeType  — e.g. "image/webp"
 * @returns {Promise<string>} Public URL
 */
async function uploadFile(buffer, key, mimeType) {
  if (USE_S3) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3Client.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000',
    }));
    return PUBLIC_URL ? `${PUBLIC_URL}/${key}` : `/uploads/${key}`;
  }

  // Local fallback (dev / when R2 not configured)
  const fullPath = path.join(LOCAL_DIR, key);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, buffer);
  return `/uploads/${key}`;
}

/**
 * Delete a file from R2 (or local disk).
 * @param {string} key  — e.g. "avatars/user_1.webp"
 */
async function deleteFile(key) {
  if (!key) return;
  if (USE_S3) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {});
    return;
  }
  const fullPath = path.join(LOCAL_DIR, key);
  fs.unlink(fullPath, () => {});
}

/**
 * Generate a unique storage key for a file.
 * @param {string} folder — e.g. "avatars"
 * @param {string} ext    — e.g. ".jpg"
 */
function generateKey(folder, ext) {
  const id = crypto.randomBytes(12).toString('hex');
  return `${folder}/${id}${ext}`;
}

module.exports = { uploadFile, deleteFile, generateKey, USE_S3 };
