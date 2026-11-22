import path from 'node:path';
import fs from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

/**
 * Content-Security-Policy σε κάθε build: μόνο τοπικά scripts· wasm για OCR και ανάγνωση QR· εικόνες/αρχεία μόνο τοπικά
 * (blob:, data:). connect-src https: χρειάζεται ΜΟΝΟ για το κατέβασμα ενός PDF από διεύθυνση που δίνει ο χρήστης
 * (services/download.ts) — καμία άλλη κλήση δικτύου δεν γίνεται. Στο dev server δεν μπαίνει (το HMR θέλει inline/websocket).
 */
function csp(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  return {
    name: 'app-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
    ],
  };
}

const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'package.json'), 'utf-8')) as { version: string };

// `--mode preview`: build για σελίδα προεπισκόπησης μέσα σε host (claude.ai Artifact) — το CSP το ορίζει ο host, και οι
// γραμματοσειρές ενσωματώνονται στο CSS (ο host δεν σερβίρει αρχεία γραμματοσειρών δίπλα στη σελίδα)
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), tailwindcss(), ...(mode === 'preview' ? [] : [csp()])],
  css: { postcss: { plugins: [] } },
  build: { target: ['safari16.4', 'ios16.4', 'chrome111'], sourcemap: false, ...(mode === 'preview' ? { assetsInlineLimit: 200_000 } : {}) },
  server: { port: 3100 },
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
}));
