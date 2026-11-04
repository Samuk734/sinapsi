# Ricerca: delega, instradamento, modello ed effort

Data: 3 novembre 2026. Le fonti sono state lette direttamente, salvo dove è indicato. Le stime di token sono mie e non sono state misurate.

## 1. Fonti

**Anthropic**
- **Claude Code, Subagents**: https://code.claude.com/docs/en/sub-agents. L'instradamento si basa sulla `description`, che resta sempre in contesto (budget complessivo di 15k token). Il `model` della chiamata ha la precedenza sul frontmatter e accetta solo alias. `SendMessage` riprende un agente con il suo contesto. Un agente senza `tools` eredita anche `Agent` e può quindi annidare altri agenti.
- **Claude Code, Best practices**: https://code.claude.com/docs/en/best-practices. Un subagent serve per lavorare in parallelo, tenere fuori gli output lunghi, avere un revisore fresco o usare meno strumenti. Non dà una risposta più intelligente e deve ricostruire il contesto. Il revisore va ancorato alla specifica ("skip style"). Dopo due correzioni fallite conviene riscrivere il prompt.
- **Claude Code, Costi e Model config**: https://code.claude.com/docs/en/costs, https://code.claude.com/docs/en/model-config. Haiku va bene per subagent semplici, e conviene chiedere sintesi brevi. Il ragionamento si paga come output, e la leva è l'effort. Opus 5.5 a medium eguaglia o supera Opus 5 a high. A Fable si descrive il risultato, non i passi.
- **API, Effort**: https://platform.claude.com/docs/en/build-with-claude/effort. Haiku 5.5 parte da medium: a low, nei prompt agentici lunghi, salta ricerche e controlli. Sonnet 5.5 usa medium nei compiti ben definiti e high in quelli lunghi o difficili. xhigh e max solo se migliorano davvero il risultato.
- **Building effective agents**: https://www.anthropic.com/engineering/building-effective-agents. Partire dalla soluzione più semplice. Pattern: routing (le domande facili al modello piccolo), parallelizzazione, orchestratore-lavoratori, valutatore-ottimizzatore.
- **Multi-agent research system**: https://www.anthropic.com/engineering/multi-agent-research-system. Il lead ha regole di scala nel prompt: 1 agente per i fatti semplici, 2-4 per i confronti, di più solo per le ricerche complesse. Senza, lanciava fino a 50 agenti. Ogni brief contiene obiettivo, formato, fonti e confini. Consuma circa 15 volte i token di una chat, con 3-5 agenti in parallelo e risultati su file.
- **Context engineering**: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents. Sintesi di 1-2k token, percorsi al posto dei contenuti, nessuno strumento ambiguo.

**Altre guide**
- **OpenAI, A practical guide to building agents**: https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf. Prima si sfrutta al massimo un agente singolo. Si misura una baseline con il modello migliore e poi si scende. Oltre una soglia di fallimenti o davanti ad azioni ad alto rischio si passa la mano all'umano.
- **Cognition, Don't build multi-agents** (2025): https://cognition.com/blog/dont-build-multi-agents. Agenti paralleli prendono decisioni implicite incompatibili. I subagent vanno bene solo per domande circoscritte.

**Progetti pubblici**
- **wshobson/agents** (`docs/agents.md`): https://github.com/wshobson/agents. Conta 202 agenti: 70 Sonnet, 54 Opus, 52 inherit, 24 Haiku, 2 Fable. Lo schema tipico è "Sonnet progetta, Haiku esegue, Sonnet rivede". Le tabelle in parte si contraddicono.
- **VoltAgent/awesome-claude-code-subagents**: https://github.com/VoltAgent/awesome-claude-code-subagents. Opus per architettura e sicurezza, Sonnet per il coding, Haiku per documentazione e ricerca. Gli strumenti sono assegnati per classe di agente.
- **musistudio/claude-code-router**: https://github.com/musistudio/claude-code-router. **Verificato solo in parte.** Il README attuale cita condizioni, retry e fallback. Le rotte background, think e longContext (60k) e il tag `<CCR-SUBAGENT-MODEL>` risultano solo da fonti secondarie.
- **lm-sys/RouteLLM**: https://github.com/lm-sys/RouteLLM. Router tra modello forte e modello debole, con soglia calibrata sul proprio traffico. Dichiara fino all'85% di costo in meno con il 95% delle prestazioni di GPT-4.
- **ruvnet/claude-flow** (ora "ruflo"): https://github.com/ruvnet/claude-flow. **Non verificabile.** Dichiara un routing intelligente con l'89% di accuratezza, ma senza indicare il metodo. Non documenta un routing per modello.

**Ricerca**
- **FrugalGPT**: https://arxiv.org/abs/2305.05176. Una cascata di LLM costa fino al 98% in meno a parità di prestazioni (dato dall'abstract).
- **AutoMix** (NeurIPS 2024): https://arxiv.org/abs/2310.12963. Sale al modello grande solo se l'auto-verifica fallisce. Risparmia oltre il 50%, ma l'auto-verifica è rumorosa.
- **Xiong et al.** (ICLR 2024): https://arxiv.org/abs/2306.13063. La fiducia che gli LLM dichiarano a parole tende a essere sovrastimata.

## 2. Regole da adottare, in ordine di resa

| # | Regola | Fonti | Impatto token (stima) |
|---|---|---|---|
| 1 | Delegare solo per un motivo esplicito: output voluminoso, parti indipendenti, verifica fresca, specialista più economico. Mai "per una risposta migliore", perché ogni agente nuovo paga l'avvio e la ricostruzione del contesto. | Best practices, Building effective agents, OpenAI | Alto: 5-20k per delega evitata |
| 2 | Dimensionare la squadra: 0-1 agenti per una domanda semplice, 2-4 per un confronto, al massimo 5 in parallelo con confini netti. | Multi-agent | Alto sui lavori ampi |
| 3 | Effort tarato sui modelli 5.5: haiku/low solo per un comando singolo, haiku/medium per esplorare, opus/medium di default. xhigh e max solo dopo un fallimento. | Effort, Model config | Medio-alto: meno ragionamento su Opus |
| 4 | Scalata con diagnosi. Se ha saltato controlli: effort +1. Se ha ragionato male: modello +1, che rende più che raddoppiare i token. L'incarico va riscritto, e dopo 2 fallimenti si chiede all'utente. Il lavoro critico parte subito dal gradino giusto. | Multi-agent, Best practices, OpenAI, FrugalGPT, AutoMix | Medio: niente rilanci ciechi |
| 5 | Seguiti e informazioni mancanti: riprendere l'agente con `SendMessage`, perché il contesto è già pronto. | Subagents | Medio: 5-20k per ripresa |
| 6 | Busta ancorata alle evidenze: un'affidabilità alta senza comando eseguito né fonte vale come sotto soglia. Parziale o bloccato si riprende o si scala, senza revisione. Esploratore e tester mai in revisione. | Xiong, AutoMix | Medio: meno revisioni inutili |
| 7 | Il revisore riceve l'incarico originale e cerca solo gli errori che cambiano il risultato: altrimenti trova sempre "qualcosa". | Best practices | Basso-medio |
| 8 | Parallelo solo su parti indipendenti, meglio se in lettura. Chi scrive in parallelo lavora su file disgiunti. | Cognition, Multi-agent | Medio: evita rifacimenti |
| 9 | Brief con criterio di fine, confini e verifica da eseguire. Checklist per haiku, risultato atteso per opus e fable. Output lunghi su file. | Multi-agent, Costi, Context engineering | Medio |
| 10 | Descrizioni minime, perché si caricano in ogni sessione. I confini tra agenti vanno nella `mansione`, che si carica solo con la skill. | Subagents, Context engineering | Basso ma fisso: circa 300 per sessione |
| 11 | Tarare i default sui propri dati: affidabilità e token per agente e modello sono già nella dashboard. | RouteLLM, OpenAI | Indiretto |

## 3. Proposta per `skill/SKILL.md`, sezioni 3-6

```markdown
## 3. Quando delegare
- **Fai da solo** domande rapide, letture singole, modifiche piccole e ciò di cui hai già il contesto: un impiegato nuovo deve ricostruirlo.
- **Delega** solo per: output voluminoso (test, log, ricerche ampie), parti indipendenti da fare in parallelo, verifica a occhi freschi, specialista più economico. Delegare non rende la risposta più intelligente.
- **Quanti**: domanda semplice 0-1 impiegati; confronto 2-4; lavoro ampio al massimo 5 in parallelo, ognuno con confini netti.
- **In parallelo** solo parti indipendenti che non scrivono gli stessi file; altrimenti in sequenza, passando avanti percorsi e sintesi.
- **Seguiti** sullo stesso lavoro: riprendi l'impiegato con `SendMessage`.

## 4. Modello ed effort: li scegli tu, a ogni chiamata
| Lavoro | model | effort |
|---|---|---|
| un comando o una ricerca puntuale: test, grep, formattazione | haiku | low |
| esplorazione a più passi, estrazione, testi da schema | haiku | medium |
| sviluppo e analisi con obiettivo chiaro, documentazione, review | sonnet | medium (high se più file o casi limite) |
| debug difficile, firmware critico, architettura, diagnosi, worst-case | opus | medium (high se critico o lungo) |
| problema aperto e di lungo respiro, o Opus ha fallito a high | fable | high |

{{MYTHOS}}
xhigh e max solo dopo un fallimento al livello sotto. Parti dal gradino più economico che regge il compito; per lavori critici o irreversibili, da quello giusto. Se fallisce:
- ha saltato ricerche o controlli → stesso modello, effort +1;
- ha ragionato male → modello +1;
- riscrivi l'incarico con ciò che hai imparato; dopo due tentativi falliti sullo stesso passo chiedi all'utente.

## 5. L'incarico, scritto per risparmiare token
- Breve e autosufficiente: obiettivo e criterio di fine, percorsi noti, confini (cosa non toccare, cosa fanno gli altri), come verificare, cosa deve contenere il report.
- Per haiku una checklist; per opus e fable il risultato atteso, non i passi.
- Non incollare file: indica i percorsi. Risultati lunghi su file, nel report solo il percorso.
- Non ripetere il metodo o il formato della busta: l'impiegato li conosce già.
- Nella `description` della chiamata metti 3-6 parole in italiano: è il titolo della nuvoletta.

## 6. La busta
Ogni report termina con `<busta>`: esito, affidabilita, revisione, sintesi.
- **Accetti** se esito `completato`, `affidabilita` ≥ {{SOGLIA}} e `revisione: no`. Un'affidabilità alta senza comandi eseguiti né fonti citate vale come sotto soglia.
- **Parziale o bloccato**: niente revisione; riprendi l'impiegato con ciò che manca, oppure sali di gradino.
- **Sotto soglia o `revisione: si`**: `sinapsi-capo-reparto` (sonnet medium; opus se il lavoro era opus e critico) con `Reparto: <id>. Incarico: <incarico originale>. Busta da verificare:` seguito dal report. Se `Respinto`, sali di gradino.
- Esploratore e tester non vanno in revisione: se la busta è debole, rilancia un gradino sopra.
- All'utente riferisci sintesi e decisioni, non i report interi.
```

## 4. Modifiche suggerite a roster e descrizioni
Nota successiva: gli impiegati non hanno più `model` né `effort` nel frontmatter. I valori qui sotto sono i consigli che compaiono nell'organico della skill; il Capo li sceglie e li passa a ogni chiamata, come impone la regola fissa della skill.

- `sinapsi-esploratore`: da haiku/low a **haiku/medium**, perché esplora su più passi.
- Impiegati opus: effort da high a **medium**, alzato a high nella singola chiamata quando il lavoro è critico. Restano a high `sinapsi-analista-guasti` e `sinapsi-reverse-firmware`, che conducono indagini lunghe.
- Sonnet: `sinapsi-consulente-normative` e `sinapsi-progettista-cablaggi` passano a medium. `sinapsi-dev-embedded` e `sinapsi-progettista-pcb` restano a high.
- `sinapsi-capo-reparto`: da low a **medium**.
- `sinapsi-redattore`: valutare haiku/medium per changelog e commenti.
- `sinapsi-reverse-firmware`: non ha `tools`, quindi eredita `Agent` e può annidare subagent. Aggiungere `disallowedTools: Agent`.
- Descrizioni: tutte nello stesso formato, `Sinapsi/<Reparto>: <verbo> <oggetti>. Solo su incarico del Capo.`, senza "use proactively".
- `mansione`: aggiungere il confine per le coppie che si sovrappongono, per esempio "non fonti web (→ documentalista)". Le coppie sono: esploratore/documentalista, guasti/reverse, calcoli/fisico, designer-ui/grafico/frontend, embedded/app, schematici/pcb/selezione-componenti, revisore/tester.
- Se si adotta `SendMessage`, va tracciato anche nella dashboard: `server/traduttore.js` oggi intercetta solo `Agent` e `Task`.
