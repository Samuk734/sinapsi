// Legge in coda i file JSONL dei subagent per estrarre pensiero, testo e token.
// Il formato delle trascrizioni è interno a Claude Code e può cambiare: tutto qui è
// difensivo e, se qualcosa non torna, si limita a non produrre eventi.
import fs from 'node:fs';

// Ultima richiesta vera dell'utente nella trascrizione del Capo. Serve quando la dashboard parte
// dopo il messaggio che l'ha aperta: quel UserPromptSubmit non è mai arrivato al server.
export function ultimaRichiesta(file, max = 1 << 20) {
  try {
    const size = fs.statSync(file).size, da = Math.max(0, size - max);
    const fd = fs.openSync(file, 'r'), buf = Buffer.alloc(size - da);
    fs.readSync(fd, buf, 0, buf.length, da); fs.closeSync(fd);
    const righe = buf.toString('utf8').split('\n');
    for (let i = righe.length - 1; i >= (da ? 1 : 0); i--) {
      let o; try { o = JSON.parse(righe[i]); } catch { continue; }
      if (o?.type !== 'user' || o.isMeta || o.isSidechain || o.message?.role !== 'user') continue;
      const c = o.message.content;
      if (Array.isArray(c) && c.some((b) => b?.type === 'tool_result')) continue;
      let testo = (typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text).join('\n') : '').trim();
      if (!testo || /^<(task-notification|system-reminder|local-command)/i.test(testo)) continue;
      const nome = /<command-name>([\s\S]*?)<\/command-name>/i.exec(testo)?.[1]?.trim();
      const args = /<command-args>([\s\S]*?)<\/command-args>/i.exec(testo)?.[1]?.trim();
      if (nome) testo = args ? `${nome} ${args}` : nome;
      return testo;
    }
  } catch { /* trascrizione assente o illeggibile */ }
  return null;
}

export class Trascrizioni {
  constructor({ onVoce, onToken, intervallo = 500 }) {
    this.onVoce = onVoce;
    this.onToken = onToken;
    this.seguiti = new Map();
    this.timer = setInterval(() => this.leggiTutti(), intervallo);
    this.timer.unref();
  }

  segui(id, candidati) {
    const s = this.seguiti.get(id);
    if (s) { s.candidati = [...new Set([...candidati, ...s.candidati])]; return; }
    this.seguiti.set(id, { candidati, file: null, offset: 0, resto: '', usi: new Map() });
  }

  smetti(id) {
    if (!this.seguiti.has(id)) return;
    this.leggi(id, this.seguiti.get(id));
    this.seguiti.delete(id);
  }

  leggiTutti() {
    for (const [id, s] of this.seguiti) this.leggi(id, s);
  }

  leggi(id, s) {
    try {
      s.file ??= s.candidati.find((p) => p && fs.existsSync(p)) ?? null;
      if (!s.file) return;
      const size = fs.statSync(s.file).size;
      if (size <= s.offset) return;
      const fd = fs.openSync(s.file, 'r');
      const buf = Buffer.alloc(size - s.offset);
      fs.readSync(fd, buf, 0, buf.length, s.offset);
      fs.closeSync(fd);
      s.offset = size;
      const righe = (s.resto + buf.toString('utf8')).split('\n');
      s.resto = righe.pop();
      for (const r of righe) if (r.trim()) this.analizza(id, s, r);
    } catch { /* file in rotazione o non leggibile: si riprova al prossimo giro */ }
  }

  analizza(id, s, riga) {
    let o;
    try { o = JSON.parse(riga); } catch { return; }
    const msg = o?.message;
    if (o?.type !== 'assistant' || !msg || !Array.isArray(msg.content)) return;
    for (const b of msg.content) {
      if (b.type === 'thinking' || b.type === 'redacted_thinking') {
        // con il pensiero nascosto il testo arriva vuoto: una riga senza testo è solo rumore
        const testo = (b.thinking || '').trim();
        if (testo) this.onVoce(id, { tipo: 'pensiero', testo });
      } else if (b.type === 'text' && b.text?.trim()) {
        // il blocco <busta> arriva già come evento a sé: qui resta solo il testo
        const testo = b.text.replace(/<busta>[\s\S]*?<\/busta>/gi, '').trim();
        if (testo) this.onVoce(id, { tipo: 'testo', testo });
      }
    }
    if (msg.usage) {
      // Una risposta può occupare più righe con lo stesso id: vale l'ultima usage.
      s.usi.set(msg.id || `riga${s.usi.size}`, msg.usage);
      const tot = { input: 0, output: 0, cache: 0, cacheScritta: 0, contesto: 0 };
      for (const u of s.usi.values()) {
        tot.input += u.input_tokens || 0;
        tot.output += u.output_tokens || 0;
        tot.cache += u.cache_read_input_tokens || 0;
        tot.cacheScritta += u.cache_creation_input_tokens || 0;
      }
      // contesto finale: quanto avrebbe occupato questo lavoro nella chat del Capo
      const u = msg.usage;
      tot.contesto = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.output_tokens || 0);
      this.onToken(id, tot, msg.model);
    }
  }
}
