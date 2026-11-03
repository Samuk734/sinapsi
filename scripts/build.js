#!/usr/bin/env node
// Genera i componenti del plugin a partire dal roster:
//   agents/sinapsi-*.md     prompt dell'impiegato + effort di default + contratto della busta
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
  const effortDi = new Map([['sinapsi-capo-reparto', 'medium']]);
  for (const r of azienda.reparti) for (const i of r.impiegati) effortDi.set(i.agente, i.effort);

  const file = new Map();
  for (const f of fs.readdirSync(path.join(HQ, 'roster/agenti')).filter((x) => x.endsWith('.md')).sort()) {
    const testo = leggi(`roster/agenti/${f}`);
    const m = /^---\n([\s\S]*?)\n---\n/.exec(testo);
    if (!m) throw new Error(`${f}: frontmatter mancante`);
    const nome = /^name:\s*(.+)$/m.exec(m[1])?.[1].trim();
    if (!nome) throw new Error(`${f}: manca name`);
    let fm = m[1];
    if (!/^effort:/m.test(fm) && effortDi.has(nome)) fm += `\neffort: ${effortDi.get(nome)}`;
    file.set(`agents/${nome}.md`, `---\n${fm}\n---\n${testo.slice(m[0].length).trimEnd()}\n${contratto}`);
  }

  const righe = ['| Area | Reparto (id) | Impiegato | Mansione | Default |', '|---|---|---|---|---|'];
  for (const area of azienda.aree) {
    for (const r of azienda.reparti.filter((x) => x.area === area.id)) {
      for (const i of r.impiegati) righe.push(`| ${area.nome.replace('Area ', '')} | ${r.nome} (\`${r.id}\`) | \`sinapsi:${i.agente}\` | ${i.mansione} | ${i.modello}/${i.effort} |`);
    }
  }
  righe.push('', 'Revisore per tutti i reparti: `sinapsi:sinapsi-capo-reparto`.');
  const mythos = config.modelli.mythos?.attivo
    ? 'Mythos non si passa chiamata per chiamata: serve un impiegato con `model: claude-mythos-5-1` nel frontmatter.'
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
