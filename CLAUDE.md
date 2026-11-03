# Sinapsi

Plugin di Claude Code: un'azienda di agenti con dashboard 3D (rete neurale e ufficio).

- Se esiste `MEMORIA.md` (appunti locali, non versionati), leggilo a inizio sessione e aggiornalo alla fine di ogni blocco di lavoro.
- Architettura e formato degli eventi: `docs/architettura.md`. Regole di scelta di agenti e modelli: `docs/ricerca-routing.md`.
- Rispondi in italiano.
- `agents/` e `skills/` sono generati: modifica `roster/` e poi esegui `npm run build`. `npm test` deve passare prima di ogni commit.
- Prima di realizzare ufficialmente una nuova parte grafica, mostra delle preview e aspetta la conferma dell'utente.
- Tieni l'utente aggiornato mentre lavori.
- Non modificare `~/.claude` (agenti, skill, hook, plugin globali) senza l'ok esplicito dell'utente.
