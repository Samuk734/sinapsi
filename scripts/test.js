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
import { decidi, MOTIVI } from '../hooks/guardia.js';

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
  // l'impiegato chiede un'informazione a un collega
  await post('/hook', { ...comuni, hook_event_name: 'PreToolUse', agent_id: A, tool_name: 'Agent', tool_use_id: 'toolu_collega',
    tool_input: { subagent_type: 'sinapsi:sinapsi-documentalista', description: 'Impedenza USB dal datasheet', prompt: 'Che impedenza differenziale chiede la USB 2.0?', model: 'sonnet', effort: 'medium' } });
  await post('/hook', { ...comuni, hook_event_name: 'SubagentStart', agent_id: 'def456', agent_type: 'sinapsi:sinapsi-documentalista' });
  await post('/hook', { ...comuni, hook_event_name: 'PostToolUse', agent_id: A, tool_name: 'Agent', tool_use_id: 'toolu_collega', tool_input: {},
    tool_response: { status: 'completed', agentId: 'def456', content: [{ type: 'text', text: '90 ohm.\n<busta>\nesito: completato\naffidabilita: 0.50\nrevisione: no\nsintesi: 90 ohm differenziali\n</busta>' }] } });
  await attesa(800);
  const testo = 'Piano GND tagliato sotto USB.\n<busta>\nesito: completato\naffidabilita: 0.65\nrevisione: no\nsintesi: taglio nel piano sotto le linee USB\n</busta>';
  await post('/hook', { ...comuni, hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: T, tool_input: {},
    tool_response: { status: 'completed', agentId: A, content: [{ type: 'text', text: testo }], resolvedModel: 'opus', totalTokens: 6200 } });
  await post('/hook', { ...comuni, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'toolu_senza_modello',
    tool_input: { subagent_type: 'sinapsi:sinapsi-tester', description: 'Senza modello', prompt: 'x' } });
  // Claude Code avvia l'impiegato in background da solo (senza run_in_background): si chiude su SubagentStop
  await post('/hook', { ...comuni, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'toolu_bg',
    tool_input: { subagent_type: 'sinapsi:sinapsi-redattore', description: 'Scrive il changelog', prompt: 'x', model: 'sonnet', effort: 'low' } });
  await post('/hook', { ...comuni, hook_event_name: 'SubagentStart', agent_id: 'bg1', agent_type: 'sinapsi:sinapsi-redattore' });
  await post('/hook', { ...comuni, hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: 'toolu_bg', tool_input: {}, tool_response: { status: 'async_launched', agentId: 'bg1' } });
  await post('/hook', { ...comuni, hook_event_name: 'SubagentStop', agent_id: 'bg1', last_assistant_message: 'Fatto.\n<busta>\nesito: completato\naffidabilita: 0.95\nrevisione: no\nsintesi: changelog scritto\n</busta>' });
  // un altro in background chiuso dalla notifica di fine lavoro, che non è una richiesta dell'utente
  await post('/hook', { ...comuni, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'toolu_notifica',
    tool_input: { subagent_type: 'sinapsi:sinapsi-esploratore', description: 'Trova i file', prompt: 'x', model: 'haiku', effort: 'low' } });
  await post('/hook', { ...comuni, hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: 'toolu_notifica', tool_input: {}, tool_response: { status: 'async_launched' } });
  await post('/hook', { ...comuni, hook_event_name: 'UserPromptSubmit', prompt: '<task-notification>\n<task-id>a9</task-id>\n<tool-use-id>toolu_notifica</tool-use-id>\n<output-file>C:\\tmp\\x.output</output-file>\n<status>completed</status>\n<result>Trovati 3 file.\n<busta>\nesito: completato\naffidabilita: 0.9\nrevisione: no\nsintesi: tre file trovati\n</busta></result>\n<usage><subagent_tokens>4200</subagent_tokens><tool_uses>2</tool_uses><duration_ms>5000</duration_ms></usage>\n</task-notification>' });
  await post('/hook', { ...comuni, hook_event_name: 'UserPromptSubmit', prompt: '<cross-session-message from="uds:x" from-name="review-sinapsi">Review pronta</cross-session-message>' });
  await post('/hook', { ...comuni, hook_event_name: 'UserPromptSubmit', prompt: '<system-reminder>promemoria interno</system-reminder>' });
  await post('/hook', { ...comuni, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'toolu_bloccato',
    tool_input: { subagent_type: 'sinapsi:sinapsi-documentalista', description: 'Datasheet STM32G0', prompt: 'x', model: 'sonnet', effort: 'medium' } });
  await post('/hook', { ...comuni, hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: 'toolu_bloccato', tool_input: {},
    tool_response: { status: 'completed', content: [{ type: 'text', text: 'st.com non risponde.\n<busta>\nesito: bloccato\naffidabilita: 0.25\nrevisione: si\nsintesi: fonte irraggiungibile\n</busta>' }] } });
  // la richiesta che apre Sinapsi arriva prima del server: si recupera dalla trascrizione del Capo
  const trascrCapo = path.join(dir, 'capo-rec.jsonl');
  fs.writeFileSync(trascrCapo, [
    { type: 'user', message: { role: 'user', content: 'Apri Sinapsi e fai il reverse di snp.exe' } },
    { type: 'user', isMeta: true, message: { role: 'user', content: [{ type: 'text', text: 'testo della skill' }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] } },
    { type: 'user', message: { role: 'user', content: '<system-reminder>promemoria</system-reminder>' } },
  ].map((o) => JSON.stringify(o)).join('\n') + '\n');
  await post('/hook', { session_id: 'sess-rec', transcript_path: trascrCapo, cwd: 'C:/y', hook_event_name: 'PreToolUse', tool_name: 'Skill', tool_input: { skill: 'sinapsi:apri' } });
  await attesa(300);

  const di = (t) => eventi.filter((e) => e.type === t);
  await prova('le sessioni che non hanno aperto Sinapsi vengono ignorate', () => assert.equal(eventi.some((e) => e.sessione === 'altra' || e.id === 'x'), false));
  await prova('capo online', () => assert.equal(di('capo.online').filter((e) => e.sessione === S).length, 1));
  await prova('richiesta arrivata prima della dashboard: recuperata dalla trascrizione', () => {
    const r = di('capo.richiesta').filter((e) => e.sessione === 'sess-rec');
    assert.equal(r.length, 1); assert.equal(r[0].testo, 'Apri Sinapsi e fai il reverse di snp.exe'); assert.equal(r[0].recuperata, true);
  });
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
  await prova('token e costo dalla trascrizione', () => { const t = di('agente.token').filter((e) => e.id === T).at(-1); assert.equal(t.input, 1000); assert.ok(t.costo > 0); });
  await prova('busta con affidabilità 0.65 instradata al capo reparto', () => {
    const b = di('busta').find((e) => e.pid === `${T}:out`);
    assert.deepEqual(b.percorso, [T, 'reparto:pcb']); assert.equal(b.affidabilita, 0.65);
  });
  await prova('collega: incarico e risposta tra impiegati, mai in revisione', () => {
    const c = di('agente.assunto').find((e) => e.id === 'toolu_collega');
    assert.equal(c?.reparto, 'ricerca'); assert.equal(c?.chiamante, T);
    assert.deepEqual(di('busta').find((e) => e.pid === 'toolu_collega:in')?.percorso, [T, 'toolu_collega']);
    assert.deepEqual(di('busta').find((e) => e.pid === 'toolu_collega:out')?.percorso, ['toolu_collega', T]);
  });
  await prova('fine lavoro e uscita', () => {
    for (const id of [T, 'toolu_collega', 'toolu_bg', 'toolu_notifica']) assert.ok(di('agente.uscito').some((e) => e.id === id), id);
  });
  await prova('impiegato messo in background da Claude Code: chiuso su SubagentStop', () => {
    assert.equal(di('busta').find((e) => e.pid === 'toolu_bg:out')?.sintesi, 'changelog scritto');
  });
  await prova('notifica di fine lavoro: chiude la scheda e non diventa una richiesta', () => {
    assert.equal(di('busta').find((e) => e.pid === 'toolu_notifica:out')?.affidabilita, 0.9);
    assert.equal(di('agente.finito').find((e) => e.id === 'toolu_notifica')?.tokenLavoro, 4200);
    assert.ok(!di('capo.richiesta').some((e) => /task-notification|system-reminder|promemoria/.test(e.testo)));
  });
  await prova('busta bloccata: torna al Capo senza revisione', () => {
    assert.deepEqual(di('busta').find((e) => e.pid === 'toolu_bloccato:out')?.percorso, ['toolu_bloccato', 'capo']);
  });
  await prova('messaggio da un\'altra sessione mostrato senza XML', () => {
    const m = di('capo.richiesta').find((e) => e.testo === 'Messaggio da review-sinapsi: Review pronta');
    assert.equal(m?.origine, 'sessione'); assert.equal(m?.da, 'review-sinapsi');
  });
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
await prova('strumenti espliciti, colleghi e blocco reverse dove servono', () => {
  const area = new Map(roster.reparti.flatMap((r) => r.impiegati.map((i) => [i.agente, r.area])));
  for (const a of attesi) {
    const t = generati.get(`agents/${a}.md`), tools = /^tools:\s*(.+)$/m.exec(t)?.[1] || '';
    assert.ok(tools && !/^disallowedTools:/m.test(t), `${a}: tools espliciti`);
    const conColleghi = !['sinapsi-capo-reparto', 'sinapsi-esploratore', 'sinapsi-tester'].includes(a);
    assert.equal(/\bAgent\b/.test(tools), conColleghi, `${a}: Agent`);
    assert.equal(t.includes('## Chiedere a un collega'), conColleghi, `${a}: colleghi`);
    assert.equal(t.includes('## Contesto e limiti del reverse'), area.get(a) === 'reverse', `${a}: reverse`);
  }
  assert.doesNotMatch(generati.get('agents/sinapsi-documentalista.md'), /\{\{/);
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
  // l'unica hook sincrona è la guardia, e solo su Bash e PowerShell
  const sincrone = Object.values(hooks).flat().filter((g) => g.hooks.some((h) => !h.async));
  assert.equal(sincrone.length, 1, 'solo la guardia può fermare un comando');
  assert.equal(sincrone[0].matcher, 'Bash|PowerShell'); assert.match(sincrone[0].hooks[0].command, /guardia\.js/);
});
await prova('guardia: ferma kill su processi altrui e installazioni globali, solo per gli impiegati', () => {
  const imp = (command, tool_name = 'Bash') => decidi({ agent_type: 'sinapsi:sinapsi-reverse-firmware', tool_name, tool_input: { command } });
  for (const c of ['taskkill //PID 10508 //F 2>&1; taskkill //PID 8280 //F', 'kill -9 $(pgrep -f unicorn)', 'pkill -f emu.py',
    'Get-Process python | Stop-Process -Force', 'cmd /c "taskkill /IM python.exe /F"']) assert.equal(imp(c), MOTIVI.processi, c);
  for (const c of ['pip install --user unicorn', 'C:/Python312/python.exe -m pip install pefile', 'npm i -g typescript', 'winget install Git.Git', 'sudo apt-get install -y binwalk'])
    assert.equal(imp(c), MOTIVI.installazioni, c);
  for (const c of ['python -I emu.py & P=$!; sleep 30; kill $P', 'kill $(cat .sinapsi/pid/emu.pid)', String.raw`Stop-Process -Id (Get-Content C:\prj\.sinapsi\pid\srv.pid)`,
    'timeout --kill-after=5 600 python -I emu.py', 'grep -rn "kill" src/', 'tasklist | grep python',
    'python -m venv .sinapsi/venv && .sinapsi/venv/Scripts/python -m pip install unicorn', 'npm install --save-dev vitest', 'cargo build'])
    assert.equal(imp(c), null, c);
  assert.equal(decidi({ tool_name: 'Bash', tool_input: { command: 'taskkill /PID 1 /F' } }), null, 'la chat del Capo non passa dalla guardia');
  assert.equal(decidi({ agent_type: 'Explore', tool_name: 'Bash', tool_input: { command: 'pkill node' } }), null, 'subagent non di Sinapsi');
});
await prova('interruttore: modulo nel plugin accanto alle hook classiche', () => {
  const h = JSON.parse(fs.readFileSync(path.join(HQ, 'hooks/hooks.json'), 'utf8'));
  const plugin = JSON.parse(fs.readFileSync(path.join(HQ, '.claude-plugin/plugin.json'), 'utf8'));
  assert.deepEqual(h.modules, ['./interruttore.tsx']); assert.ok(h.hooks.PreToolUse, 'le hook classiche restano');
  assert.equal(plugin.types, './types/index.d.ts');
  const m = fs.readFileSync(path.join(HQ, 'hooks/interruttore.tsx'), 'utf8');
  assert.match(m, /agent\.offer/); assert.match(m, /plugin: 'sinapsi'/);
  assert.match(fs.readFileSync(path.join(HQ, 'types/index.d.ts'), 'utf8'), /sinapsi: \{ acceso: boolean \}/);
});
await prova('la skill impone model ed effort a ogni chiamata', () => {
  assert.match(generati.get('skills/apri/SKILL.md'), /Regola fissa.*`model` ed `effort`/);
});

console.log(`\n${ok} prove superate.`);
process.exit(0);
