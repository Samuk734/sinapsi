// Traduce i payload degli hook di Claude Code in eventi dell'azienda Sinapsi.
// Formato degli hook: https://code.claude.com/docs/en/hooks.md
import path from 'node:path';
import { Trascrizioni } from './trascrizioni.js';

const STRUMENTI_AGENTE = new Set(['Agent', 'Task']);
const CAPO_REPARTO = 'sinapsi-capo-reparto';
// Dentro un plugin gli agenti hanno il prefisso del plugin (sinapsi:sinapsi-tester): si confronta il nome nudo
const nomeAgente = (t) => String(t || '').replace(/^[^:]+:/, '');
const corto = (s, n = 60) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const base = (p) => (p ? path.basename(String(p)) : '');

export function leggiBusta(testo) {
  testo = String(testo || '');
  const m = /<busta>([\s\S]*?)<\/busta>/i.exec(testo);
  if (!m) return { esito: 'completato', affidabilita: null, revisione: false, sintesi: '', corpo: testo.trim() };
  const campo = (k) => new RegExp(`^\\s*${k}\\s*:\\s*(.+)$`, 'im').exec(m[1])?.[1]?.trim();
  const aff = parseFloat((campo('affidabilit[aà]') || '').replace(',', '.'));
  return {
    esito: (campo('esito') || 'completato').toLowerCase(),
    affidabilita: Number.isFinite(aff) ? Math.max(0, Math.min(1, aff)) : null,
    revisione: /^s[iì]/i.test(campo('revisione') || ''),
    sintesi: campo('sintesi') || '',
    corpo: testo.slice(0, m.index).trim(),
  };
}

export function riassumiStrumento(tool, inp = {}) {
  switch (tool) {
    case 'Read': return `Legge ${base(inp.file_path)}`;
    case 'Grep': return `Cerca “${corto(inp.pattern, 28)}”`;
    case 'Glob': return `Elenca ${corto(inp.pattern, 32)}`;
    case 'Edit': case 'MultiEdit': return `Modifica ${base(inp.file_path)}`;
    case 'Write': return `Scrive ${base(inp.file_path)}`;
    case 'Bash': case 'PowerShell': return inp.description ? corto(inp.description, 44) : `Esegue ${corto(inp.command, 40)}`;
    case 'WebSearch': return `Cerca sul web “${corto(inp.query, 28)}”`;
    case 'WebFetch': try { return `Legge ${new URL(inp.url).host}`; } catch { return 'Legge una pagina web'; }
    case 'Agent': case 'Task': return `Delega: ${corto(inp.description, 40)}`;
    case 'TodoWrite': return 'Aggiorna la sua lista';
    default: return `Usa ${tool}`;
  }
}

function testoRisposta(r) {
  if (typeof r === 'string') return r;
  const c = r?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((b) => (typeof b === 'string' ? b : b?.text || '')).join('\n');
  return '';
}

export class Traduttore {
  constructor({ emit, azienda, config }) {
    this.emit = emit;
    this.azienda = azienda;
    this.config = config;
    this.sessioniCapo = new Map();   // session_id -> { cwd }
    this.agenti = new Map();         // id (tool_use_id) -> scheda dell'agente
    this.perAgentId = new Map();     // agent_id -> id
    this.inAttesa = [];              // assunzioni non ancora collegate a un SubagentStart
    this.daRivedere = new Map();     // reparto -> id delle buste instradate al capo reparto
    this.trascrizioni = new Trascrizioni({
      onVoce: (id, v) => this.emit({ type: 'agente.pensiero', id, ...v }),
      onToken: (id, tot, modello) => this.aggiornaToken(id, tot, modello),
    });
  }

  capi() { return [...this.sessioniCapo.keys()]; }

  // --- Ricerche nel roster ------------------------------------------------
  scheda(agente) {
    for (const r of this.azienda.reparti) {
      const imp = r.impiegati.find((i) => i.agente === agente);
      if (imp) return { reparto: r.id, ...imp };
    }
    return null;
  }

  prezzo(modello) {
    const chiave = Object.keys(this.config.modelli).find((k) => k === modello || this.config.modelli[k].id === modello || String(modello || '').includes(k));
    return chiave ? { chiave, ...this.config.modelli[chiave].prezzo } : null;
  }

  // --- Ingresso -----------------------------------------------------------
  hook(p) {
    if (!p || typeof p !== 'object') return;
    const ev = p.hook_event_name;
    const sessione = p.session_id;
    if (ev === 'PreToolUse' && p.tool_name === 'Skill' && /sinapsi/i.test(p.tool_input?.skill || p.tool_input?.command || p.tool_input?.name || '')) {
      return this.capoOnline(p);
    }
    // Una sessione che assume impiegati sinapsi-* è un Capo anche se non ha aperto la skill
    if (ev === 'PreToolUse' && STRUMENTI_AGENTE.has(p.tool_name) && !p.agent_id && nomeAgente(p.tool_input?.subagent_type).startsWith('sinapsi-')) {
      if (!this.sessioniCapo.has(sessione)) this.capoOnline(p);
    }
    if (!this.sessioniCapo.has(sessione)) return;

    switch (ev) {
      case 'UserPromptSubmit':
        return this.emit({ type: 'capo.richiesta', sessione, testo: corto(p.prompt, 280) });
      case 'PreToolUse':
        if (p.agent_id) return this.passoAgente(p, 'pre');
        if (STRUMENTI_AGENTE.has(p.tool_name)) return this.assumi(p);
        return this.emit({ type: 'capo.stato', sessione, testo: riassumiStrumento(p.tool_name, p.tool_input) });
      case 'PostToolUse':
        if (p.agent_id) return this.passoAgente(p, 'post');
        if (STRUMENTI_AGENTE.has(p.tool_name)) return this.consegna(p.tool_use_id, p.tool_response, p.tool_response?.agentId);
        return;
      case 'SubagentStart': return this.collega(p);
      case 'SubagentStop': return this.fermato(p);
      case 'SessionEnd':
        this.sessioniCapo.delete(sessione);
        return this.emit({ type: 'capo.offline', sessione });
      default: return;
    }
  }

  // Eventi inviati direttamente (CLI, skill)
  eventoDiretto(ev) {
    if (!ev?.type) return;
    if (ev.type === 'vacancy') ev.vid ??= `v${Date.now().toString(36)}`;
    this.emit(ev);
  }

  // --- Ciclo di vita ------------------------------------------------------
  capoOnline(p) {
    if (this.sessioniCapo.has(p.session_id)) return;
    this.sessioniCapo.set(p.session_id, { cwd: p.cwd, trascrizione: p.transcript_path });
    this.emit({ type: 'capo.online', sessione: p.session_id, cwd: p.cwd });
  }

  assumi(p) {
    const inp = p.tool_input || {};
    const tipo = nomeAgente(inp.subagent_type) || 'general-purpose';
    const id = p.tool_use_id || `t${Date.now().toString(36)}`;
    const titolo = corto(inp.description || 'Incarico', 48);

    if (tipo === CAPO_REPARTO) {
      const reparto = /reparto\s*:\s*([a-z0-9_-]+)/i.exec(inp.prompt || '')?.[1]?.toLowerCase() || 'ricerca';
      const nodo = `reparto:${reparto}`;
      const revisioneDi = this.daRivedere.get(reparto)?.shift();
      const a = { id, nodo, ruolo: 'capo-reparto', agente: tipo, reparto, modello: inp.model || 'sonnet', effort: inp.effort || 'low', titolo, sessione: p.session_id, revisioneDi };
      this.agenti.set(id, a);
      this.inAttesa.push({ id, tipo, sessione: p.session_id });
      this.emit({ type: 'agente.assunto', ...a, incarico: corto(inp.prompt, 600) });
      this.emit({ type: 'busta', pid: `${id}:in`, tipo: 'incarico', percorso: ['capo', nodo], titolo, contenuto: corto(inp.prompt, 2000) });
      return;
    }

    const s = this.scheda(tipo);
    const reparto = s?.reparto || 'esterni';
    const a = {
      id, nodo: id, ruolo: 'impiegato', agente: tipo, reparto,
      nome: s?.nome || tipo,
      modello: inp.model || s?.modello || 'eredita',
      effort: inp.effort || s?.effort || 'default',
      titolo, sessione: p.session_id, inBackground: !!inp.run_in_background,
    };
    this.agenti.set(id, a);
    this.inAttesa.push({ id, tipo, sessione: p.session_id });
    this.emit({ type: 'agente.assunto', ...a, incarico: corto(inp.prompt, 600) });
    const percorso = reparto === 'esterni' ? ['capo', id] : ['capo', `reparto:${reparto}`, id];
    this.emit({ type: 'busta', pid: `${id}:in`, tipo: 'incarico', percorso, titolo, contenuto: corto(inp.prompt, 2000) });
  }

  collega(p) {
    if (this.perAgentId.has(p.agent_id)) return; // SubagentStart si ripete quando un agente riprende
    const i = this.inAttesa.findIndex((x) => x.sessione === p.session_id && x.tipo === (nomeAgente(p.agent_type) || x.tipo));
    if (i < 0) return;
    const { id } = this.inAttesa.splice(i, 1)[0];
    this.registraAgentId(id, p.agent_id, p.transcript_path, p.session_id);
    this.emit({ type: 'agente.al_lavoro', id, agentId: p.agent_id });
  }

  registraAgentId(id, agentId, trascrizioneCapo, sessione) {
    const a = this.agenti.get(id);
    if (!a || !agentId) return;
    a.agentId = agentId;
    this.perAgentId.set(agentId, id);
    if (trascrizioneCapo) {
      const dir = path.join(path.dirname(trascrizioneCapo), sessione, 'subagents');
      const nudo = String(agentId).replace(/^agent-/, '');
      this.trascrizioni.segui(id, [path.join(dir, `agent-${nudo}.jsonl`), path.join(dir, `${agentId}.jsonl`)]);
    }
  }

  passoAgente(p, fase) {
    const id = this.perAgentId.get(p.agent_id);
    if (!id) return;
    if (fase === 'pre') {
      const testo = riassumiStrumento(p.tool_name, p.tool_input);
      this.emit({ type: 'agente.stato', id, strumento: p.tool_name, testo });
      this.emit({ type: 'agente.pensiero', id, tipo: 'strumento', testo, dettaglio: corto(JSON.stringify(p.tool_input || {}), 400) });
    } else {
      const r = p.tool_response;
      const testo = typeof r === 'string' ? r : r?.stdout ?? r?.content ?? r?.file?.content ?? JSON.stringify(r ?? '');
      this.emit({ type: 'agente.pensiero', id, tipo: 'risultato', testo: corto(testo, 300) });
    }
  }

  aggiornaToken(id, tot, modelloTrascrizione) {
    const a = this.agenti.get(id);
    if (!a) return;
    a.token = tot;
    const pr = this.prezzo(modelloTrascrizione || a.modello);
    const costo = pr ? (tot.input * pr.in + tot.output * pr.out + tot.cache * pr.cache + tot.cacheScritta * pr.in * 1.25) / 1e6 : null;
    this.emit({ type: 'agente.token', id, ...tot, costo });
  }

  consegna(id, risposta, agentId) {
    const a = this.agenti.get(id);
    if (!a || a.finito) return;
    if (agentId && !a.agentId) this.registraAgentId(id, agentId);
    if (risposta?.status === 'async_launched') return; // in background: si chiude su SubagentStop
    this.chiudi(a, testoRisposta(risposta), risposta);
  }

  fermato(p) {
    const id = this.perAgentId.get(p.agent_id);
    const a = id && this.agenti.get(id);
    if (!a) return;
    if (p.agent_transcript_path) this.trascrizioni.segui(id, [p.agent_transcript_path]);
    if (a.inBackground && !a.finito) this.chiudi(a, p.last_assistant_message || '', null);
  }

  chiudi(a, testo, risposta) {
    a.finito = true;
    this.trascrizioni.smetti(a.id);
    const b = leggiBusta(testo);
    const soglia = this.config.routing.sogliaAffidabilita;
    if (!a.token && risposta?.totalTokens) this.emit({ type: 'agente.token', id: a.id, input: risposta.totalTokens, output: 0, cache: 0, cacheScritta: 0, costo: null, stima: true });
    const tokenLavoro = a.token ? a.token.input + a.token.output + a.token.cache + a.token.cacheScritta : risposta?.totalTokens || 0;
    const tokenBusta = Math.ceil(testo.length / 4);

    let percorso, tipo = 'report';
    if (a.ruolo === 'capo-reparto') { percorso = [a.nodo, 'capo']; tipo = 'verdetto'; }
    else if (a.reparto !== 'esterni' && b.affidabilita !== null && (b.affidabilita < soglia || b.revisione)) {
      percorso = [a.id, `reparto:${a.reparto}`];
      if (!this.daRivedere.has(a.reparto)) this.daRivedere.set(a.reparto, []);
      this.daRivedere.get(a.reparto).push(a.id);
    }
    else percorso = [a.id, 'capo'];

    this.emit({
      type: 'busta', pid: `${a.id}:out`, tipo, percorso, titolo: a.titolo,
      esito: b.esito, affidabilita: b.affidabilita, revisione: b.revisione, sintesi: b.sintesi,
      contenuto: corto(b.corpo, 4000), modelloUsato: risposta?.resolvedModel,
    });
    this.emit({ type: 'agente.finito', id: a.id, esito: b.esito, affidabilita: b.affidabilita, tokenLavoro, tokenBusta, durataMs: risposta?.totalDurationMs });
    this.emit({ type: 'agente.uscito', id: a.id });
    if (a.agentId) this.perAgentId.delete(a.agentId);
    this.agenti.delete(a.id);
  }
}
