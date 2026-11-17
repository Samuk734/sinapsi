#!/usr/bin/env node
// Guardia di Sinapsi: hook PreToolUse sincrona su Bash e PowerShell, solo per gli impiegati
// (agent_type sinapsi:*). Ferma due errori visti nelle review:
//   1. chiudere processi scelti dalla lista di sistema, che possono essere di altre sessioni;
//   2. installare pacchetti globali senza l'ok dell'utente.
// La chat del Capo e i subagent che non sono di Sinapsi passano senza controlli.
// In caso di dubbio o di errore lascia passare: non deve mai rompere il lavoro.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Inizio di un comando: inizio riga o dopo ; & | ( ` , anche dietro sudo, cmd /c, powershell -Command
const INIZIO = String.raw`(?:^|[;&|(\x60\n]|\bthen\b|\bdo\b|\belse\b)\s*`
  + String.raw`(?:(?:sudo|exec|nohup|xargs|cmd(?:\.exe)?\s+\/[ck]|(?:powershell|pwsh)(?:\.exe)?(?:\s+-\w+)*)\s+["']?)*`
  + String.raw`(?:\S*[\\/])?`;
const re = (s, f = 'im') => new RegExp(s, f);

const UCCIDE = [
  re(INIZIO + String.raw`(?:taskkill|tskill|pkill|killall|kill|stop-process|spps)(?:\.exe)?(?=\s|$|[;&|)'"])`),
  re(String.raw`\bwmic\b[^\n]*\bprocess\b[^\n]*\b(?:delete|terminate)\b`),
  re(String.raw`\b(?:get-process|getprocesses\w*|getprocessby\w*)\b[^\n]*\.kill\s*\(`),
];
// Processi propri: $! (avviato nello stesso comando), job della shell, file dei PID, sola verifica
const PROPRI = /\$!|\bkill\s+(?:-\w+\s+)*%\d|\.sinapsi[\\/]pid\b|\bkill\s+-(?:0|l|s\s+0)\b/i;

const PIP = re(INIZIO + String.raw`(?:(?:python[\d.]*|py)(?:\.exe)?\s+(?:-\S+\s+)*-m\s+)?pip[\d.]*(?:\.exe)?\s+install\b`);
const PIP_LOCALE = /venv|--target\b|--dry-run\b/i;
const GLOBALI = [
  String.raw`pipx(?:\.exe)?\s+install\b`,
  String.raw`uv(?:\.exe)?\s+tool\s+install\b`,
  String.raw`uv(?:\.exe)?\s+pip\s+install\b(?=[^\n]*--system\b)`,
  String.raw`(?:npm|pnpm)(?:\.cmd)?\s+(?:install|i|add)\b(?=[^\n;&|]*(?:\s-g\b|--global\b|--location[= ]global))`,
  String.raw`npm(?:\.cmd)?\s+(?:-g|--global)\s+(?:install|i|add)\b`,
  String.raw`yarn(?:\.cmd)?\s+global\s+add\b`,
  String.raw`(?:winget|choco|scoop|brew|apt|apt-get|dnf|yum|zypper|snap|cargo|gem)(?:\.exe)?\s+install\b`,
  String.raw`pacman\s+-S`,
  String.raw`go(?:\.exe)?\s+install\b`,
  String.raw`dotnet(?:\.exe)?\s+tool\s+install\b(?=[^\n]*(?:\s-g\b|--global\b))`,
  String.raw`(?:install-module|install-package|install-script)\b`,
  String.raw`msiexec(?:\.exe)?\s+[/-]i\b`,
].map((s) => re(INIZIO + s));

export const MOTIVI = {
  processi: 'Guardia di Sinapsi: chiudi solo i processi che hai avviato tu in questo incarico. '
    + 'Lancia i comandi lunghi con `timeout <secondi>`. Se un processo deve restare vivo tra due comandi, salva il PID all\'avvio '
    + 'in `<radice>/.sinapsi/pid/<nome>.pid` e chiudilo leggendo quel file. Non scegliere mai i processi dalla lista di sistema: '
    + 'sulla macchina girano altre sessioni. Se va fermato un processo che non è tuo, scrivilo nel report.',
  installazioni: 'Guardia di Sinapsi: niente installazioni globali senza l\'ok dell\'utente, perché restano sulla macchina per tutte le sessioni. '
    + 'Per Python usa un venv nel progetto: `python -m venv <radice>/.sinapsi/venv`, poi `<radice>/.sinapsi/venv/Scripts/python -m pip install …` '
    + '(`bin/python` su Linux e macOS), e annotalo negli appunti. Per il resto chiudi con `esito: bloccato` e scrivi nel report il comando da far approvare.',
};

// Ritorna il motivo del blocco, oppure null se il comando può passare.
export function decidi(p) {
  if (!p || !/^(?:[^:]+:)?sinapsi-/.test(String(p.agent_type || ''))) return null;
  if (p.tool_name !== 'Bash' && p.tool_name !== 'PowerShell') return null;
  const cmd = String(p.tool_input?.command || '');
  if (!cmd) return null;
  if (UCCIDE.some((r) => r.test(cmd)) && !PROPRI.test(cmd)) return MOTIVI.processi;
  if ((PIP.test(cmd) && !PIP_LOCALE.test(cmd)) || GLOBALI.some((r) => r.test(cmd))) return MOTIVI.installazioni;
  return null;
}

const stessoFile = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
if (process.argv[1] && stessoFile(process.argv[1], fileURLToPath(import.meta.url))) {
  let corpo = '';
  const passa = () => process.exit(0);
  setTimeout(passa, 3000).unref();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { corpo += c; });
  process.stdin.on('end', () => {
    try {
      const motivo = decidi(JSON.parse(corpo));
      if (motivo) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: motivo },
        }));
      }
    } catch { /* payload illeggibile: si lascia passare */ }
    passa();
  });
}
