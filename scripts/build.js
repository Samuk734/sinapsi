#!/usr/bin/env node
// Genera i componenti del plugin a partire dal roster:
//   agents/sinapsi-*.md     prompt dell'impiegato + blocchi comuni (reverse, colleghi) + contratto della busta
//                           (modello ed effort li sceglie il Capo; strumenti sempre espliciti)
//   skills/apri/SKILL.md    la skill del Capo, con l'organico e le soglie
//   node scripts/build.js           scrive i file
//   node scripts/build.js --check   esce con errore se i file generati non sono aggiornati (per la CI)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HQ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leggi = (p) => fs.readFileSync(path.join(HQ, p), 'utf8').replace(/\r\n/g, '\n');

export function costruisci() {
  const config = JSON.parse(leggi('config/sinapsi.json'));
  const azienda = JSON.parse(leggi('roster/azienda.json'));
  const contratto = leggi('roster/contratto-busta.md');
  const reverse = leggi('roster/contratto-reverse.md');
  const areaDi = new Map(azienda.reparti.flatMap((r) => r.impiegati.map((i) => [i.agente, r.area])));
  // chi può chiedere aiuto a un collega: tutti tranne chi fa lavoro meccanico o di verifica
  const SENZA_COLLEGHI = new Set(['sinapsi-capo-reparto', 'sinapsi-esploratore', 'sinapsi-tester']);
  const colleghi = leggi('roster/contratto-colleghi.md').replace('{{COLLEGHI}}', azienda.reparti
    .map((r) => `- ${r.nome}: ${r.impiegati.map((i) => i.agente.replace(/^sinapsi-/, '')).join(', ')}`).join('\n'));

  const file = new Map();
  for (const f of fs.readdirSync(path.join(HQ, 'roster/agenti')).filter((x) => x.endsWith('.md')).sort()) {
    const testo = leggi(`roster/agenti/${f}`);
    const m = /^---\n([\s\S]*?)\n---\n/.exec(testo);
    if (!m) throw new Error(`${f}: frontmatter mancante`);
    const nome = /^name:\s*(.+)$/m.exec(m[1])?.[1].trim();
    if (!nome) throw new Error(`${f}: manca name`);
    // niente model né effort nel frontmatter: li sceglie il Capo a ogni chiamata
    if (/^(model|effort):/m.test(m[1])) throw new Error(`${f}: model ed effort non vanno fissati nell'agente`);
    // senza una lista esplicita l'impiegato eredita tutti gli strumenti e parte con ~55.000 token di contesto invece di ~6.000
    const tools = /^tools:\s*(.+)$/m.exec(m[1]);
    if (!tools || /^disallowedTools:/m.test(m[1])) throw new Error(`${f}: servono strumenti espliciti (tools:), senza disallowedTools`);
    let fronte = m[1], blocchi = '';
    if (areaDi.get(nome) === 'reverse') blocchi += reverse;
    if (!SENZA_COLLEGHI.has(nome)) {
      if (!/\bAgent\b/.test(tools[1])) fronte = fronte.replace(tools[0], `${tools[0].trimEnd()}, Agent`);
      blocchi += colleghi;
    }
    file.set(`agents/${nome}.md`, `---\n${fronte}\n---\n${testo.slice(m[0].length).trimEnd()}\n${blocchi}${contratto}`);
  }

  // organico compatto: un titolo per area, una riga per reparto, una per impiegato
  const righe = ['Dopo ogni nome: modello/effort consigliati e mansione.'];
  for (const area of azienda.aree) {
    righe.push('', `**${area.nome.replace('Area ', '')}**`);
    for (const r of azienda.reparti.filter((x) => x.area === area.id)) {
      righe.push(`- ${r.nome} (\`${r.id}\`)`);
      for (const i of r.impiegati) righe.push(`  - \`sinapsi:${i.agente}\` ${i.modello}/${i.effort}: ${i.mansione}`);
    }
  }
  righe.push('', 'Revisore per tutti i reparti: `sinapsi:sinapsi-capo-reparto`.');
  const mythos = config.modelli.mythos?.attivo
    ? `${config.modelli.mythos.nome} non si sceglie nella chiamata. Se l'utente lo vuole, la sessione del Capo deve girare con \`--model ${config.modelli.mythos.id}\`: allora, solo per gli impiegati che devono usarlo, ometti \`model\` e lo ereditano.`
    : 'Mythos non è attivo in questa installazione: non usarlo.';
  file.set('skills/apri/SKILL.md', leggi('roster/skill.template.md')
    .replace('{{ROSTER}}', righe.join('\n'))
    .replace('{{SOGLIA}}', String(config.routing.sogliaAffidabilita))
    .replace('{{MYTHOS}}', mythos));
  return file;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = costruisci();
  const controlla = process.argv.includes('--check');
  const diversi = [];
  for (const [rel, contenuto] of file) {
    const dest = path.join(HQ, rel);
    const attuale = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
    if (attuale === contenuto) continue;
    diversi.push(rel);
    if (!controlla) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, contenuto, 'utf8'); }
  }
  // agenti generati che non esistono più nel roster
  for (const f of fs.existsSync(path.join(HQ, 'agents')) ? fs.readdirSync(path.join(HQ, 'agents')) : []) {
    if (file.has(`agents/${f}`)) continue;
    diversi.push(`agents/${f} (da rimuovere)`);
    if (!controlla) fs.rmSync(path.join(HQ, 'agents', f));
  }
  if (controlla && diversi.length) {
    console.error(`File generati non aggiornati: esegui "npm run build".\n  ${diversi.join('\n  ')}`);
    process.exit(1);
  }
  console.log(controlla ? `OK: ${file.size} file generati aggiornati.` : `Scritti ${diversi.length} file su ${file.size}.`);
}
