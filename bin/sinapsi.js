#!/usr/bin/env node
// CLI di Sinapsi, usata dal Capo (la chat) e dall'utente.
//   node bin/sinapsi.js stato
//   node bin/sinapsi.js avvia [--apri] [--demo]   (riavvia da solo un server più vecchio del plugin)
//   node bin/sinapsi.js riavvia [--apri] | ferma
//   node bin/sinapsi.js apri
//   node bin/sinapsi.js posizione-aperta --reparto <id> --ruolo "<nome>" --motivo "<perché>" [--modello sonnet]
//   node bin/sinapsi.js demo on|off
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HQ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(HQ, 'config/sinapsi.json'), 'utf8'));
const PORT = Number(process.env.SINAPSI_PORT) || config.port;
const URL_HQ = `http://localhost:${PORT}`;

function richiesta(metodo, percorso, corpo) {
  return new Promise((ok) => {
    const dati = corpo ? JSON.stringify(corpo) : '';
    const req = http.request({ host: '127.0.0.1', port: PORT, path: percorso, method: metodo, timeout: 1500,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(dati) } }, (res) => {
      let s = ''; res.on('data', (c) => { s += c; });
      res.on('end', () => { try { ok({ ok: true, codice: res.statusCode, dati: s ? JSON.parse(s) : null }); } catch { ok({ ok: true, codice: res.statusCode }); } });
    });
    req.on('error', () => ok({ ok: false }));
    req.on('timeout', () => { req.destroy(); ok({ ok: false }); });
    req.end(dati);
  });
}

function opzioni(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      o[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    }
  }
  return o;
}

function apriBrowser() {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', URL_HQ]]
    : process.platform === 'darwin' ? ['open', [URL_HQ]] : ['xdg-open', [URL_HQ]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
}

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

// Al primo avvio dopo l'installazione del plugin manca la libreria 3D: la scarica npm, una volta sola.
function dipendenze() {
  if (fs.existsSync(path.join(HQ, 'node_modules/three/build/three.module.js'))) return true;
  console.log('Primo avvio: installo la grafica 3D (three.js, circa 30 MB)…');
  const r = spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: HQ, stdio: 'inherit', shell: true });
  if (r.status !== 0) { console.log('ERRORE: npm install non riuscito. Serve Node.js con npm e una connessione a internet.'); return false; }
  return true;
}

const VERSIONE = JSON.parse(fs.readFileSync(path.join(HQ, 'package.json'), 'utf8')).version;
// confronto di versioni a.b.c: negativo se a è più vecchia di b
const confronta = (a, b) => {
  const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
};

// PID del processo in ascolto sulla porta di Sinapsi: serve solo per i server fino alla 0.2.2, che non hanno /api/spegni
function pidSullaPorta() {
  if (process.platform === 'win32') {
    const r = spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', windowsHide: true });
    const riga = (r.stdout || '').split('\n').find((l) => new RegExp(`:${PORT}\\s+\\S+\\s+LISTENING`, 'i').test(l));
    return Number(riga?.trim().split(/\s+/).at(-1)) || null;
  }
  const r = spawnSync('lsof', ['-nP', `-iTCP:${PORT}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
  return Number((r.stdout || '').trim().split('\n')[0]) || null;
}

// Ferma il server in ascolto. Chiede la chiusura ordinata; i server vecchi si chiudono dal PID della porta,
// dopo aver controllato che a rispondere sia davvero Sinapsi.
async function ferma() {
  const h = await richiesta('GET', '/health');
  if (!h.ok) return true;
  if (h.dati?.nome !== 'sinapsi') { console.log(`ERRORE: sulla porta ${PORT} risponde un altro programma.`); return false; }
  const r = await richiesta('POST', '/api/spegni', {});
  if (!r.ok || r.codice !== 200) {
    const pid = h.dati.pid || pidSullaPorta();
    if (!pid) { console.log(`ERRORE: non trovo il processo del server sulla porta ${PORT}.`); return false; }
    try { process.kill(pid); } catch { /* già chiuso */ }
  }
  for (let i = 0; i < 25; i++) { if (!(await richiesta('GET', '/health')).ok) return true; await attendi(200); }
  console.log('ERRORE: il server vecchio non si è chiuso.');
  return false;
}

// Appunti di progetto rimasti in sottocartelle (versioni fino alla 0.2.1): li segnala al Capo, che li unisce.
// Cerca fino a 3 livelli sotto la cartella di lavoro, saltando dipendenze e cartelle nascoste.
function appuntiSparsi(radice = process.cwd()) {
  const trovati = [], SALTA = new Set(['node_modules', 'vendor', 'build', 'dist', 'target', 'venv', '__pycache__']);
  let visitate = 0;
  const giu = (dir, livello) => {
    if (livello > 3 || ++visitate > 3000) return;
    let voci; try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const v of voci) {
      if (!v.isDirectory()) continue;
      if (v.name === '.sinapsi') { if (livello > 0 && fs.existsSync(path.join(dir, v.name, 'progetto.md'))) trovati.push(path.relative(radice, path.join(dir, v.name, 'progetto.md'))); continue; }
      if (v.name.startsWith('.') || SALTA.has(v.name)) continue;
      giu(path.join(dir, v.name), livello + 1);
    }
  };
  giu(radice, 0);
  if (trovati.length) console.log(`Appunti da unire in .sinapsi/progetto.md: ${trovati.join(', ')}`);
}

async function avvia(o) {
  let s = await richiesta('GET', '/health');
  if (s.ok && s.dati?.nome === 'sinapsi' && confronta(s.dati.versione, VERSIONE) < 0) {
    console.log(`Server Sinapsi ${s.dati.versione || 'precedente alla 0.2.3'} attivo, plugin ${VERSIONE}: lo riavvio (la dashboard riparte vuota).`);
    if (!(await ferma())) process.exit(1);
    s = { ok: false };
  }
  if (!s.ok) {
    if (!dipendenze()) process.exit(1);
    const args = [path.join(HQ, 'server/server.js')];
    if (o.demo) args.push('--demo');
    spawn(process.execPath, args, { cwd: HQ, detached: true, stdio: 'ignore', windowsHide: true }).unref();
    for (let i = 0; i < 30 && !(s = await richiesta('GET', '/health')).ok; i++) await attendi(200);
    if (!s.ok) { console.log('ERRORE: il server non risponde. Prova: node server/server.js'); process.exit(1); }
    console.log(`Sinapsi ${VERSIONE} avviato: ${URL_HQ}`);
  } else {
    console.log(`Sinapsi già attivo: ${URL_HQ} (server ${s.dati?.versione || '?'}, plugin ${VERSIONE})`);
  }
  appuntiSparsi();
  if (o.apri) apriBrowser();
}

const [comando, ...resto] = process.argv.slice(2);
const o = opzioni(resto);

switch (comando) {
  case 'stato': {
    const s = await richiesta('GET', '/health');
    console.log(s.ok ? `online ${URL_HQ} — server ${s.dati.versione || 'precedente alla 0.2.3'}, plugin ${VERSIONE}, eventi: ${s.dati.eventi}, viewer: ${s.dati.clienti}` : 'offline');
    break;
  }
  case 'avvia': await avvia(o); break;
  case 'riavvia': if (await ferma()) await avvia(o); else process.exit(1); break;
  case 'ferma': console.log((await ferma()) ? 'Sinapsi fermato.' : 'Sinapsi non fermato.'); break;
  case 'apri': apriBrowser(); break;
  case 'demo': {
    const s = await richiesta('POST', '/api/demo', { on: resto[0] !== 'off' });
    console.log(s.ok ? `demo: ${s.dati.demo ? 'attiva' : 'ferma'}` : 'offline');
    break;
  }
  case 'posizione-aperta': {
    if (!o.reparto || !o.ruolo) { console.log('Servono --reparto e --ruolo'); process.exit(1); }
    const s = await richiesta('POST', '/event', {
      type: 'vacancy', reparto: o.reparto, ruolo: o.ruolo, motivo: o.motivo || '', modello: o.modello || 'sonnet',
    });
    console.log(s.ok ? 'Posizione aperta pubblicata in bacheca.' : 'offline (posizione non pubblicata)');
    break;
  }
  default:
    console.log('Comandi: stato | avvia [--apri] [--demo] | riavvia [--apri] | ferma | apri | demo on|off | posizione-aperta --reparto R --ruolo "X" --motivo "Y" [--modello M]');
}
