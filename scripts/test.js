#!/usr/bin/env node
// Collaudo della logica: server + traduttore + trascrizioni + installatore.
// Non tocca ~/.claude: l'installatore viene provato in una cartella temporanea.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { leggiBusta, riassumiStrumento } from '../server/traduttore.js';
import { costruisci } from './build.js';

const HQ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 7499;
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0;
const prova = async (nome, fn) => { await fn(); ok++; console.log(`  ✓ ${nome}`); };

function post(percorso, corpo) {
  return new Promise((res, rej) => {
    const d = JSON.stringify(corpo);
    const r = http.request({ host: '127.0.0.1', port: PORT, path: percorso, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(d) } }, (x) => { x.resume(); x.on('end', res); });
    r.on('error', rej); r.end(d);
  });
}

console.log('Unità');
await prova('busta completa', () => {
  const b = leggiBusta('Report.\n\n<busta>\nesito: parziale\naffidabilita: 0,62\nrevisione: sì\nsintesi: manca la prova su scheda\n</busta>');
  assert.equal(b.esito, 'parziale'); assert.equal(b.affidabilita, 0.62); assert.equal(b.revisione, true);
  assert.equal(b.sintesi, 'manca la prova su scheda'); assert.equal(b.corpo, 'Report.');
});
await prova('report senza busta', () => { const b = leggiBusta('solo testo'); assert.equal(b.affidabilita, null); assert.equal(b.corpo, 'solo testo'); });
await prova('affidabilità fuori scala viene limitata', () => assert.equal(leggiBusta('<busta>affidabilita: 7</busta>').affidabilita, 1));
await prova('riassunto strumenti', () => {
  assert.equal(riassumiStrumento('Read', { file_path: 'C:/a/b/main.c' }), 'Legge main.c');
  assert.match(riassumiStrumento('WebFetch', { url: 'https://modbus.org/x.pdf' }), /modbus\.org/);
});

console.log('Catena hook → eventi');
const server = spawn(process.execPath, [path.join(HQ, 'server/server.js')], { env: { ...process.env, SINAPSI_PORT: String(PORT) }, stdio: 'ignore' });
const eventi = [];
try {
  for (let i = 0; i < 30; i++) { try { await post('/event', { type: 'ping' }); break; } catch { await attesa(150); } }
  http.get({ host: '127.0.0.1', port: PORT, path: '/stream' }, (res) => {
    let buf = '';
    res.on('data', (c) => {
      buf += c;
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const blocco = buf.slice(0, i); buf = buf.slice(i + 2);
        const dati = blocco.split('\n').find((l) => l.startsWith('data: '));
        if (dati && !blocco.startsWith('event:')) eventi.push(JSON.parse(dati.slice(6)));
      }
    });
    res.on('error', () => {});
  }).on('error', () => {});
  await attesa(300);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sinapsi-test-'));
  const S = 'sess-test', A = 'abc123', T = 'toolu_test1';
  const comuni = { session_id: S, transcript_path: path.join(dir, `${S}.jsonl`), cwd: 'C:/x' };
  const fileAgente = path.join(dir, S, 'subagents', `agent-${A}.jsonl`);
  fs.mkdirSync(path.dirname(fileAgente), { recursive: true });

  await post('/hook', { ...comuni, session_id: 'altra', hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'x', tool_input: { subagent_type: 'Explore' } });
  await post('/hook', { ...comuni, hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'sinapsi' } });
  await post('/hook', { ...comuni, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: T,
    tool_input: { subagent_type: 'sinapsi:sinapsi-progettista-pcb', description: 'Rivedi lo stackup', prompt: 'Controlla board.kicad_pcb', model: 'opus', effort: 'xhigh' } });
  await post('/hook', { ...comuni, hook_event_name: 'SubagentStart', agent_id: A, agent_type: 'sinapsi:sinapsi-progettista-pcb' });
  await post('/hook', { ...comuni, hook_event_name: 'PreToolUse', agent_id: A, agent_type: 'sinapsi-progettista-pcb', tool_name: 'Read', tool_input: { file_path: 'hw/board.kicad_pcb' } });
  fs.appendFileSync(fileAgente, JSON.stringify({ type: 'assistant', message: { id: 'm1', model: 'claude-opus-5-5', content: [{ type: 'thinking', thinking: 'Controllo i piani di riferimento.' }], usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0 } } }) + '\n');
  await attesa(800);
  const testo = 'Piano GND tagliato sotto USB.\n<busta>\nesito: completato\naffidabilita: 0.65\nrevisione: no\nsintesi: taglio nel piano sotto le linee USB\n</busta>';
  await post('/hook', { ...comuni, hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: T, tool_input: {},
    tool_response: { status: 'completed', agentId: A, content: [{ type: 'text', text: testo }], resolvedModel: 'opus', totalTokens: 6200 } });
  await post('/hook', { ...comuni, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'toolu_senza_modello',
    tool_input: { subagent_type: 'sinapsi:sinapsi-tester', description: 'Senza modello', prompt: 'x' } });
  await attesa(300);

  const di = (t) => eventi.filter((e) => e.type === t);
  await prova('le sessioni che non hanno aperto Sinapsi vengono ignorate', () => assert.equal(eventi.some((e) => e.sessione === 'altra' || e.id === 'x'), false));
  await prova('capo online', () => assert.equal(di('capo.online').length, 1));
  await prova('chiamata senza modello: la dashboard mostra eredita/sessione, non un default del roster', () => {
    const a = di('agente.assunto').find((e) => e.id === 'toolu_senza_modello');
    assert.equal(a?.modello, 'eredita'); assert.equal(a?.effort, 'sessione');
  });
  await prova('assunzione (nome con prefisso del plugin) con reparto, modello ed effort', () => {
    const a = di('agente.assunto')[0];
    assert.equal(a.reparto, 'pcb'); assert.equal(a.modello, 'opus'); assert.equal(a.effort, 'xhigh'); assert.equal(a.titolo, 'Rivedi lo stackup');
  });
  await prova('busta di incarico Capo → capo reparto → impiegato', () => assert.deepEqual(di('busta')[0].percorso, ['capo', 'reparto:pcb', T]));
  await prova('collegamento SubagentStart', () => assert.equal(di('agente.al_lavoro')[0]?.id, T));
  await prova('nuvoletta di stato dal passo dell\'impiegato', () => assert.equal(di('agente.stato')[0]?.testo, 'Legge board.kicad_pcb'));
  await prova('pensiero letto dalla trascrizione', () => assert.ok(di('agente.pensiero').some((e) => e.tipo === 'pensiero' && /piani/.test(e.testo))));
  await prova('token e costo dalla trascrizione', () => { const t = di('agente.token').at(-1); assert.equal(t.input, 1000); assert.ok(t.costo > 0); });
  await prova('busta con affidabilità 0.65 instradata al capo reparto', () => {
    const b = di('busta').find((e) => e.tipo === 'report');
    assert.deepEqual(b.percorso, [T, 'reparto:pcb']); assert.equal(b.affidabilita, 0.65);
  });
  await prova('fine lavoro e uscita', () => { assert.equal(di('agente.finito').length, 1); assert.equal(di('agente.uscito').length, 1); });
} finally {
  server.kill();
}

console.log('Plugin');
const generati = costruisci();
const roster = JSON.parse(fs.readFileSync(path.join(HQ, 'roster/azienda.json'), 'utf8'));
const attesi = new Set(['sinapsi-capo-reparto', ...roster.reparti.flatMap((r) => r.impiegati.map((i) => i.agente))]);
await prova(`tutti i ${attesi.size} impiegati del roster generati`, () => {
  for (const a of attesi) assert.ok(generati.has(`agents/${a}.md`), `manca ${a}`);
});
await prova('ogni impiegato ha il contratto della busta e nessun modello o effort fisso', () => {
  for (const [k, t] of generati) if (k.startsWith('agents/')) { assert.doesNotMatch(t, /^(model|effort):/m, k); assert.match(t, /<busta>/, k); }
});
await prova('skill compilata senza segnaposto, con i nomi del plugin', () => {
  const t = generati.get('skills/apri/SKILL.md');
  assert.doesNotMatch(t, /\{\{/); assert.match(t, /sinapsi:sinapsi-progettista-cablaggi/); assert.match(t, /\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/sinapsi\.js/);
});
await prova('i file generati nella repo sono aggiornati', () => {
  for (const [k, t] of generati) assert.equal(fs.readFileSync(path.join(HQ, k), 'utf8'), t, `${k} non aggiornato: npm run build`);
});
await prova('manifest e hook del plugin coerenti', () => {
  const plugin = JSON.parse(fs.readFileSync(path.join(HQ, '.claude-plugin/plugin.json'), 'utf8'));
  const market = JSON.parse(fs.readFileSync(path.join(HQ, '.claude-plugin/marketplace.json'), 'utf8'));
  const hooks = JSON.parse(fs.readFileSync(path.join(HQ, 'hooks/hooks.json'), 'utf8')).hooks;
  assert.equal(plugin.name, 'sinapsi'); assert.equal(market.plugins[0].name, plugin.name);
  for (const ev of ['PreToolUse', 'PostToolUse', 'SubagentStart', 'SubagentStop']) assert.ok(hooks[ev]?.[0].hooks[0].async, ev);
  assert.ok(Object.values(hooks).flat().every((g) => g.hooks.every((h) => h.async)), 'nessun hook deve bloccare Claude');
});
await prova('la skill impone model ed effort a ogni chiamata', () => {
  assert.match(generati.get('skills/apri/SKILL.md'), /Regola fissa.*`model` ed `effort`/);
});

console.log(`\n${ok} prove superate.`);
process.exit(0);
