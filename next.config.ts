import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Only what the app uses is allowed. Fonts are not loaded from anywhere, the browser never calls
 * Supabase (every read goes through our API routes), and sound is Web Audio, which needs no
 * media-src. 'wasm-unsafe-eval' is for the meshopt decoder that unpacks the phone model, and blob:
 * is for the textures three.js decodes from that model.
 *
 * script-src needs 'unsafe-inline' because Next writes inline bootstrap and RSC payload scripts
 * into every page. Both strict options were tried or ruled out: experimental.sri does not cover
 * inline scripts (the browser blocked all eight on the home page), and a nonce needs per-request
 * rendering, which cacheComponents and partialPrefetching rule out. Scripts are still limited to
 * our own origin, with no object, base or frame escapes, and no outside connect targets.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "connect-src 'self' blob:",
  "img-src 'self' data: blob:",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};
export default nextConfig;
