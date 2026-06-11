'use strict';
/**
 * Smart compression middleware — Brotli preferred, Gzip fallback.
 * Uses Node.js built-in zlib (no extra deps).
 *
 * Brotli is ~20-30% smaller than gzip for JS/CSS/HTML.
 * All modern browsers (Chrome, Firefox, Safari, Edge) support it.
 */
const zlib = require('zlib');

// Content-types worth compressing
const COMPRESSIBLE = /text|javascript|json|xml|svg|css/i;
// Don't compress small responses (overhead > savings)
const THRESHOLD = 1024;

module.exports = function compress(options = {}) {
  const threshold = options.threshold || THRESHOLD;

  return function compressionMiddleware(req, res, next) {
    if (req.method === 'HEAD' || req.method === 'OPTIONS') return next();

    const accept = req.headers['accept-encoding'] || '';
    const useBrotli = accept.includes('br');
    const useGzip   = !useBrotli && accept.includes('gzip');
    if (!useBrotli && !useGzip) return next();

    const _write = res.write.bind(res);
    const _end   = res.end.bind(res);
    let enc     = null;
    let started = false;

    function initEncoder() {
      if (started) return;
      started = true;

      const ct = (res.getHeader('content-type') || '').split(';')[0];
      if (!COMPRESSIBLE.test(ct)) return;

      // Skip tiny already-known-small responses
      const cl = parseInt(res.getHeader('content-length') || '0', 10);
      if (cl > 0 && cl < threshold) return;

      if (useBrotli) {
        enc = zlib.createBrotliCompress({
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 4, // 0-11; 4 = good speed/ratio
            [zlib.constants.BROTLI_PARAM_LGWIN]:   22,
          },
        });
        res.setHeader('Content-Encoding', 'br');
      } else {
        enc = zlib.createGzip({ level: 6 });
        res.setHeader('Content-Encoding', 'gzip');
      }

      res.setHeader('Vary', 'Accept-Encoding');
      res.removeHeader('Content-Length');

      enc.on('data', (chunk) => _write(chunk));
      enc.on('end',  ()      => _end());
      enc.on('error', (err)  => {
        // Compression failed mid-stream — best effort: close cleanly
        enc = null;
        _end();
      });
    }

    res.write = function(chunk, encoding, cb) {
      initEncoder();
      if (enc) {
        enc.write(chunk, typeof encoding === 'string' ? encoding : undefined);
        if (typeof encoding === 'function') encoding();
        else if (cb) cb();
        return true;
      }
      return _write(chunk, encoding, cb);
    };

    res.end = function(chunk, encoding, cb) {
      initEncoder();
      if (enc) {
        if (chunk != null && chunk !== '') {
          enc.write(chunk, typeof encoding === 'string' ? encoding : undefined);
        }
        enc.end();
        return this;
      }
      return _end(chunk, encoding, cb);
    };

    next();
  };
};
