#!/usr/bin/env node
// Hook PreToolUse sul tool Agent: gli impiegati Sinapsi non hanno un modello fisso,
// quindi una chiamata senza `model` viene respinta (exit 2) e il motivo torna al Capo,
// che la ripete scegliendo modello ed effort. Ogni altro caso passa (exit 0).
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const nomeAgente = (t) => String(t || '').replace(/^[^:]+:/, '');

export function motivoRifiuto(p) {
  if (!p || (p.tool_name !== 'Agent' && p.tool_name !== 'Task')) return null;
  const inp = p.tool_input || {};
  const nome = nomeAgente(inp.subagent_type);
  if (!nome.startsWith('sinapsi-') || String(inp.model || '').trim()) return null;
  return `Sinapsi: gli impiegati non hanno un modello di default, lo sceglie il Capo a ogni chiamata. `
    + `Ripeti la chiamata a ${inp.subagent_type} passando model (haiku, sonnet, opus o fable) `
    + `ed effort (low, medium o high; xhigh e max solo dopo un fallimento), `
    + `secondo la tabella "Modello ed effort" della skill sinapsi:apri.`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setTimeout(() => process.exit(0), 2000).unref();
  let body = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { body += c; });
  process.stdin.on('end', () => {
    let motivo = null;
    try { motivo = motivoRifiuto(JSON.parse(body)); } catch { /* payload illeggibile: lascia passare */ }
    if (!motivo) process.exit(0);
    process.stderr.write(motivo + '\n');
    process.exit(2);
  });
}
