# Sinapsi: architettura

```
 Nuova chat Claude Code ──"apri Sinapsi"──► skill `sinapsi:apri`  ⇒ la chat diventa IL CAPO
        │  chiama Agent(subagent_type, model, effort, description, prompt)
        ▼
 Impiegati = subagent del plugin  sinapsi:sinapsi-*   (prompt "addestrato" + tool minimi)
        │  ogni passo genera hook (PreToolUse, SubagentStart, ...)   ← nessun token extra
        ▼
 hooks/emit.js ──POST /hook──► server/server.js ──► traduttore.js ──► eventi Sinapsi
                                     │                    └─ trascrizioni.js (pensiero, token)
                                     └──SSE /stream──► web app (rete neurale 3D ⇄ ufficio)
```

## Componenti
| File | Ruolo |
|---|---|
| `roster/skill.template.md` → `skills/apri/SKILL.md` | Il "badge" del Capo: apertura, organico, regole per scegliere modello ed effort, busta, formazione. `npm run build` lo compila con l'organico. |
| `roster/azienda.json` | Reparti, capi reparto e impiegati (per la UI e per l'organico della skill). Modello ed effort qui sono solo consigli per il Capo. |
| `roster/agenti/*.md` → `agents/` | Il prompt specifico di ogni impiegato; nel plugin si chiama `sinapsi:<nome>`. Il frontmatter non ha `model` né `effort` (il build lo vieta): li passa il Capo a ogni chiamata. |
| `roster/contratto-busta.md` | Regole comuni e formato della busta, aggiunti in coda a ogni agente da `npm run build`. |
| `hooks/emit.js` | Sensore: inoltra il payload dell'hook al server. Non scrive mai su stdout ed esce sempre con 0. |
| `hooks/scelta-modello.js` | Sensore sincrono su PreToolUse di `Agent`: se un impiegato `sinapsi-*` viene chiamato senza `model`, esce con 2 e il motivo torna al Capo, che ripete la chiamata scegliendo il modello. Il traduttore applica la stessa regola e non assume nessuno per le chiamate respinte. |
| `server/server.js` | HTTP + SSE su porta 7420, replay degli eventi alla connessione, file statici. |
| `server/traduttore.js` | Traduce gli hook (formato Claude Code) in eventi Sinapsi. Tiene la mappa tool_use_id ↔ agent_id. |
| `server/trascrizioni.js` | Legge in coda i JSONL dei subagent: pensiero, testo, strumenti, token. |
| `server/demo.js` | Simulatore: produce hook e trascrizioni finti realistici, così la UI si vede anche senza Claude. |
| `bin/sinapsi.js` | CLI: `avvia`, `stato`, `apri`, `demo`, `posizione-aperta`. |
| `scripts/build.js` | Genera `agents/` e `skills/` dal roster. Con `--check` verifica che siano aggiornati (CI). |
| `.claude-plugin/` | Manifest del plugin e del marketplace (la repo è installabile con `/plugin marketplace add`). |
| `hooks/hooks.json` | Collega i sensori agli eventi di Claude Code: `emit.js` in modalità asincrona, `scelta-modello.js` sincrono e solo sul tool `Agent`. |

## Perché questa architettura fa risparmiare token
1. **Contesto del Capo pulito**: il lavoro degli impiegati (letture, output dei comandi) resta nel loro contesto; al Capo arriva solo la busta.
2. **Modello giusto per ogni lavoro**: Haiku per il lavoro meccanico, Opus o Fable solo dove servono.
3. **Prompt degli impiegati corti e stabili**, con strumenti minimi: meno token per chiamata e più riuso della cache.
4. **La grafica costa zero**: nuvolette e buste derivano dagli eventi, non da chiamate LLM.
5. **Costo fisso minimo**: in contesto ci sono sempre solo le descrizioni brevi degli agenti e quella della skill. Le istruzioni del Capo si caricano solo quando apri Sinapsi.
6. **Revisione solo se serve**: il capo reparto interviene solo sotto la soglia di affidabilità.

## Eventi Sinapsi (server → web app)
Campi comuni: `seq`, `ts`, `type`.

| type | Campi | Origine |
|---|---|---|
| `capo.online` | `sessione`, `cwd` | PreToolUse della skill `sinapsi` |
| `capo.richiesta` | `sessione`, `testo` | UserPromptSubmit della sessione Capo |
| `agente.assunto` | `id`, `agente`, `nome`, `reparto`, `modello`, `effort`, `incarico`, `titolo` | PreToolUse dello strumento Agent |
| `agente.al_lavoro` | `id`, `agentId` | SubagentStart |
| `agente.stato` | `id`, `testo`, `strumento` | PreToolUse dentro il subagent |
| `agente.pensiero` | `id`, `tipo` (pensiero, testo, strumento, risultato), `testo` | trascrizione del subagent |
| `agente.token` | `id`, `input`, `output`, `cache`, `costo` | trascrizione del subagent |
| `busta` | `pid`, `da`, `a`, `tipo` (incarico, report, verdetto), `affidabilita`, `esito`, `sintesi`, `contenuto` | PreToolUse e PostToolUse di Agent |
| `agente.finito` | `id`, `esito`, `affidabilita` | PostToolUse di Agent |
| `agente.uscito` | `id` | dopo `agente.finito` (la web app anima l'uscita) |
| `vacancy` | `vid`, `reparto`, `ruolo`, `motivo`, `modello` | `bin/sinapsi.js posizione-aperta` |
| `roster.update` | `azienda` | dopo una nuova formazione |

Gli identificativi dei nodi nella rete sono: `capo`, `reparto:<id>` (il capo reparto) e `<id agente>` (il tool_use_id dell'assunzione).

## Instradamento delle buste
- incarico: Capo → capo reparto → impiegato (il passaggio dal capo reparto è solo visivo, per far vedere l'organigramma).
- report con affidabilità ≥ soglia e revisione no: impiegato → Capo.
- report sotto soglia, o con revisione sì: impiegato → capo reparto, poi il verdetto va dal capo reparto al Capo.
