// Server locale di Sinapsi: riceve gli hook di Claude Code, li traduce in eventi
// dell'azienda e li trasmette in diretta (SSE) alla web app.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Traduttore } from './traduttore.js';
import { Demo } from './demo.js';

const HQ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leggiJson = (p) => JSON.parse(fs.readFileSync(path.join(HQ, p), 'utf8'));
const config = leggiJson('config/sinapsi.json');
let azienda = leggiJson('roster/azienda.json');
const PORT = Number(process.env.SINAPSI_PORT) || config.port;
const MAX_LOG = 3000;

// ---- Bus eventi -----------------------------------------------------------
const log = [];
const clienti = new Set();
let seq = 0;

export function emit(ev) {
  const e = { seq: ++seq, ts: Date.now(), ...ev };
  log.push(e);
  if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
  const riga = `data: ${JSON.stringify(e)}\n\n`;
  for (const res of clienti) res.write(riga);
  return e;
}

const traduttore = new Traduttore({ emit, azienda, config });
const demo = new Demo({ traduttore, emit, azienda, config });

// ---- HTTP -----------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary',
};
const STATICI = [
  ['/vendor/three/', path.join(HQ, 'node_modules/three/')],
  ['/', path.join(HQ, 'public/')],
];

function json(res, code, obj) {
  res.writeHead(code, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function leggiCorpo(req) {
  return new Promise((ok, ko) => {
    let s = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { s += c; if (s.length > 5e6) req.destroy(); });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { ko(e); } });
    req.on('error', ko);
  });
}

function servaStatico(req, res, url) {
  for (const [prefisso, dir] of STATICI) {
    if (!url.pathname.startsWith(prefisso)) continue;
    let rel = decodeURIComponent(url.pathname.slice(prefisso.length));
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(dir, rel);
    if (!file.startsWith(path.resolve(dir))) break;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Non trovato');
}

function apriStream(req, res) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  res.write(`event: replay\ndata: ${JSON.stringify({ azienda, modelli: config.modelli, eventi: log, demo: demo.attiva })}\n\n`);
  clienti.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => { clearInterval(ping); clienti.delete(res); });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, nome: 'sinapsi', eventi: seq, clienti: clienti.size, demo: demo.attiva, capi: traduttore.capi() });
    }
    if (req.method === 'GET' && url.pathname === '/stream') return apriStream(req, res);
    if (req.method === 'GET' && url.pathname === '/api/azienda') return json(res, 200, { azienda, modelli: config.modelli });
    if (req.method === 'POST' && url.pathname === '/hook') {
      traduttore.hook(await leggiCorpo(req));
      res.writeHead(204); return res.end();
    }
    if (req.method === 'POST' && url.pathname === '/event') {
      const corpo = await leggiCorpo(req);
      for (const ev of [].concat(corpo)) traduttore.eventoDiretto(ev);
      res.writeHead(204); return res.end();
    }
    if (req.method === 'POST' && url.pathname === '/api/demo') {
      const { on } = await leggiCorpo(req);
      on ? demo.avvia() : demo.ferma();
      return json(res, 200, { demo: demo.attiva });
    }
    if (req.method === 'POST' && url.pathname === '/api/ricarica-roster') {
      azienda = leggiJson('roster/azienda.json');
      traduttore.azienda = demo.azienda = azienda;
      emit({ type: 'roster.update', azienda });
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET') return servaStatico(req, res, url);
    res.writeHead(405); res.end();
  } catch (err) {
    json(res, 400, { errore: String(err?.message || err) });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[sinapsi] porta ${PORT} già in uso: il server è probabilmente già attivo.`);
    process.exit(0);
  }
  throw err;
});

server.listen(PORT, config.host, () => {
  console.log(`[sinapsi] HQ online su http://localhost:${PORT}`);
  if (process.argv.includes('--demo')) demo.avvia();
});
