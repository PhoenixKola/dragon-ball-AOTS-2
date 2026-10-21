// Zero-dependency static server for the production build. Binds to 127.0.0.1 only (no network exposure).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { existsSync } from 'node:fs';

const root = resolve(import.meta.dirname, '..', 'dist');
if (!existsSync(join(root, 'index.html'))) { console.error('dist/ not found. Run "npm run build" first (or use the prebuilt release folder).'); process.exit(1); }
const port = Number(process.env.PORT || 5173);
const mime = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const full = resolve(join(root, rel));
    if (!(full === root || full.startsWith(root + sep))) { res.writeHead(403); res.end('Forbidden'); return; }
    const st = await stat(full); if (!st.isFile()) throw new Error('nf');
    res.writeHead(200, { 'Content-Type': mime[extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(full));
  } catch { res.writeHead(404); res.end('404'); }
});
server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${port} is already in use. Close the other game window or set PORT=5200.` : String(e)); process.exit(1); });
server.listen(port, '127.0.0.1', () => console.log(`ATTACK OF THE SAIYANS II - NAMEK SAGA\nRunning at http://127.0.0.1:${port}  (offline, local only)\nClose this window to quit.`));
