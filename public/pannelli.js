// Pannelli condivisi dalle due viste: Roadmap, Dettaglio, flusso di coscienza, ticker delle buste.
// Ogni vista fornisce come si chiama un nodo e cosa fare quando si clicca un passo.
import { coloreModello, coloreAffidabilita, esc } from './comune.js';

const $ = (id) => document.getElementById(id);
export const ora = (ts) => new Date(ts || Date.now()).toLocaleTimeString('it-IT');
const PASSO = {
  incarico: ['incarico', '#ffcf73'], pensiero: ['pensa', '#b794ff'], testo: ['scrive', '#e8eeff'],
  strumento: ['fa', '#38e1ff'], risultato: ['vede', '#9aa8c8'], busta: ['busta', '#34d399'],
};
export const idDaPid = (pid) => String(pid || '').replace(/:(in|out)$/, '');

export function creaPannelli({ azienda, nomeDi, vaiA }) {
  const registro = new Map();   // id istanza -> { info, nome, colore, passi, busta, revisioni, stato }
  const richieste = [];
  const aperte = new Set();
  const destra = $('destra');
  let schedaDestra = 'roadmap', dettaglioDi = null, rmTimer = null;

  function registra(e) {
    switch (e.type) {
      case 'capo.richiesta': richieste.push({ testo: e.testo, ts: e.ts, ids: [] }); break;
      case 'agente.assunto': {
        const rep = azienda.reparti.find((r) => r.id === e.reparto), capoRep = e.ruolo === 'capo-reparto';
        registro.set(e.id, {
          id: e.id, info: e, capoRep, reparto: rep, colore: rep?.colore || '#cbd5e1',
          nome: capoRep ? (rep?.capoReparto.nome || 'Capo reparto') : (e.nome || e.agente),
          passi: [{ tipo: 'incarico', testo: e.incarico || e.titolo, ts: e.ts }], stato: 'al lavoro', revisioni: [],
        });
        if (!richieste.length) richieste.push({ testo: 'Sessione in corso', ts: e.ts, ids: [] });
        richieste.at(-1).ids.push(e.id);
        if (e.revisioneDi) registro.get(e.revisioneDi)?.revisioni.push(e.id);
        break;
      }
      case 'agente.pensiero': registro.get(e.id)?.passi.push({ tipo: e.tipo, testo: e.testo, det: e.dettaglio, ts: e.ts }); break;
      case 'agente.stato': { const s = registro.get(e.id); if (s) s.statoTesto = e.testo; break; }
      case 'agente.token': { const s = registro.get(e.id); if (s) s.token = e; break; }
      case 'busta': {
        if (e.tipo === 'incarico') break;
        const s = registro.get(idDaPid(e.pid));
        if (s) { s.busta = e; s.stato = 'consegnato'; s.passi.push({ tipo: 'busta', testo: e.sintesi || e.titolo, ts: e.ts, busta: e }); }
        break;
      }
      case 'agente.finito': { const s = registro.get(e.id); if (s) { s.stato = 'finito'; s.fine = e; } break; }
      default: return;
    }
    ridisegna();
  }

  function htmlPasso(s, p, i, extra = '') {
    const [nome, c] = PASSO[p.tipo] || [p.tipo, '#fff'];
    const col = p.tipo === 'busta' ? coloreAffidabilita(p.busta?.affidabilita) : c;
    let corpo = esc(p.testo || (p.tipo === 'pensiero' ? 'ragiona in silenzio…' : ''));
    if (p.tipo === 'busta' && p.busta) {
      const b = p.busta;
      corpo = `<b>${esc(b.sintesi || b.titolo)}</b> <span class="chip" style="--m:${col}">${b.affidabilita != null ? Math.round(b.affidabilita * 100) + '%' : '—'} · ${esc(b.esito || '')}</span>`
        + `<div class="det">→ ${esc(nomeDi(b.percorso.at(-1)))}</div>${b.contenuto ? `<pre>${esc(b.contenuto)}</pre>` : ''}`;
    }
    const det = p.det && p.tipo === 'strumento' ? `<div class="det">${esc(p.det)}</div>` : '';
    return `<div class="passo ${p.tipo} ${extra}" style="--c:${col}" data-id="${esc(s.id)}" data-i="${i}">`
      + `<span class="tipo">${nome}</span><span class="ora">${ora(p.ts)}</span><div class="tx">${corpo}</div>${det}</div>`;
  }

  // tutta la storia di un lavoro, revisioni del capo reparto comprese
  function htmlLavoro(s, evidenzia) {
    if (!s) return '<div class="sotto">Nessun dato su questo lavoro.</div>';
    let h = `<div class="tl">${s.passi.map((p, i) => htmlPasso(s, p, i, evidenzia != null && p.nodo === evidenzia ? 'evidenza' : '')).join('')}`;
    if (s.stato === 'al lavoro') h += `<div class="passo vivo" style="--c:${s.colore}"><span class="tipo">ora</span><div class="tx">${esc(s.statoTesto || 'al lavoro…')}</div></div>`;
    h += '</div>';
    for (const rid of s.revisioni) {
      const r = registro.get(rid);
      if (r) h += `<div class="sottotit" style="--c:${r.colore}">Revisione · ${esc(r.nome)} <span class="chip" style="--m:${coloreModello(r.info.modello)}">${esc(r.info.modello)} · ${esc(r.info.effort)}</span></div>${htmlLavoro(r, evidenzia)}`;
    }
    return h;
  }

  function testaLavoro(s) {
    const m = coloreModello(s.info.modello);
    const tok = s.token ? `${((s.token.input + s.token.output + s.token.cache + (s.token.cacheScritta || 0)) / 1000).toFixed(1)}k token` : '';
    return `<h2 style="color:${s.colore}">${esc(s.nome)}</h2>
      <div class="sotto">${esc(s.reparto?.nome || 'esterno')} · <span class="chip" style="--m:${m}">${esc(s.info.modello)} · ${esc(s.info.effort)}</span> ${tok}</div>
      <div class="riga"><span>Incarico</span><span>${esc(s.info.titolo)}</span></div>`;
  }

  // ---- Pannello destro: Roadmap / Dettaglio ----------------------------------------------------
  function apriDestra(scheda) {
    schedaDestra = scheda;
    document.body.classList.remove('senza-destra');
    for (const b of destra.querySelectorAll('.schede button[data-tab]')) b.classList.toggle('on', b.dataset.tab === scheda);
    $('roadmap').classList.toggle('nascosto', scheda !== 'roadmap');
    $('dettaglio').classList.toggle('nascosto', scheda !== 'dettaglio');
    if (scheda === 'roadmap') disegnaRoadmap();
  }
  function chiudiDestra() { document.body.classList.add('senza-destra'); dettaglioDi = null; }
  const alternaDestra = () => (document.body.classList.contains('senza-destra') ? apriDestra('roadmap') : chiudiDestra());
  destra.querySelector('.schede').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tab) apriDestra(b.dataset.tab); else chiudiDestra();
  });
  $('apriDestra').onclick = () => apriDestra('roadmap');
  $('bRoadmap').onclick = alternaDestra;

  function ridisegna() {
    if (rmTimer) return;
    rmTimer = setTimeout(() => { rmTimer = null; disegnaRoadmap(); if (dettaglioDi && schedaDestra === 'dettaglio') dettaglioDi(); }, 350);
  }
  function disegnaRoadmap() {
    if (schedaDestra !== 'roadmap' || document.body.classList.contains('senza-destra')) return;
    const el = $('roadmap'), scroll = el.scrollTop;
    el.innerHTML = richieste.slice(-4).reverse().map((r) => {
      const righe = r.ids.map((id) => registro.get(id)).filter((s) => s && !(s.capoRep && s.info.revisioneDi && registro.has(s.info.revisioneDi)));
      const vivi = righe.filter((s) => s.stato === 'al lavoro').length;
      return `<div class="rm-richiesta"><b>Richiesta al Capo</b><span class="ora">${ora(r.ts)} · ${righe.length} connessioni${vivi ? ` · ${vivi} al lavoro` : ''}</span><div>${esc(r.testo)}</div></div>`
        + righe.map((s) => {
          const b = s.busta, col = b ? coloreAffidabilita(b.affidabilita) : s.colore;
          const esito = s.stato === 'al lavoro' ? '<span class="vivo"></span>' : `<b style="color:${col}">${b?.affidabilita != null ? Math.round(b.affidabilita * 100) + '%' : '✓'}</b>`;
          const via = s.capoRep ? `Capo → ${esc(s.nome)}` : `Capo → ${esc(s.reparto?.nome || 'esterni')} → ${esc(s.nome)}`;
          const ultimo = s.stato === 'al lavoro' ? (s.statoTesto || 'si sveglia…') : (b?.sintesi || '');
          return `<div class="conn ${aperte.has(s.id) ? 'aperta' : ''}" style="--c:${s.colore}" data-id="${esc(s.id)}">
            <div class="testa"><div class="mezzo"><div class="via">${via}</div><div class="cosa">${esc(s.info.titolo)}</div><div class="ultimo">${esc(ultimo)}</div></div>
            <span class="chip" style="--m:${coloreModello(s.info.modello)}">${esc(s.info.modello)}·${esc(s.info.effort)}</span>${esito}</div>
            ${aperte.has(s.id) ? `<div class="corpo-conn">${htmlLavoro(s)}</div>` : ''}</div>`;
        }).join('');
    }).join('') || '<div class="sotto">In attesa della prima richiesta al Capo…</div>';
    el.scrollTop = scroll;
  }
  destra.addEventListener('click', (e) => {
    const passo = e.target.closest('.passo[data-id]');
    if (passo) { const s = registro.get(passo.dataset.id); if (s) vaiA(s, s.passi[+passo.dataset.i]); return; }
    const testa = e.target.closest('.conn .testa');
    if (testa) { const id = testa.parentElement.dataset.id; aperte.has(id) ? aperte.delete(id) : aperte.add(id); disegnaRoadmap(); }
  });

  function mostraDettaglio(f) { dettaglioDi = f; f(); apriDestra('dettaglio'); }
  function apriBusta(e) {
    mostraDettaglio(() => {
      const s = registro.get(idDaPid(e.pid));
      const m = e.tipo === 'incarico' ? '#7dd3fc' : coloreAffidabilita(e.affidabilita);
      $('dettaglio').innerHTML = `<h3 class="tit">Pacchetto intercettato <span>${esc(e.tipo)}</span></h3><h2>${esc(e.titolo)}</h2>
        <div class="sotto">${esc(nomeDi(e.percorso[0]))} → ${esc(nomeDi(e.percorso.at(-1)))} · ${ora(e.ts)}</div>
        ${e.affidabilita != null ? `<div class="riga"><span>Affidabilità</span><span style="color:${m}">${Math.round(e.affidabilita * 100)}% · ${esc(e.esito)}${e.revisione ? ' · revisione richiesta' : ''}</span></div><div class="barra-aff" style="--m:${m}"><i style="width:${e.affidabilita * 100}%"></i></div>` : ''}
        ${s ? `<h3 class="tit" style="margin-top:14px">Ragionamento completo <span>${s.passi.length} passi</span></h3>${testaLavoro(s)}${htmlLavoro(s)}` : `<pre>${esc(e.contenuto || '')}</pre>`}`;
    });
  }
  // tutti i lavori (ultimi tre) di un impiegato o di un capo reparto
  function apriLavori({ titolo, stato, nome, colore, sottotitolo, filtro }) {
    mostraDettaglio(() => {
      const lavori = [...registro.values()].filter(filtro).slice(-3).reverse();
      $('dettaglio').innerHTML = `<h3 class="tit">${esc(titolo)} <span>${esc(stato)}</span></h3><h2 style="color:${colore}">${esc(nome)}</h2><div class="sotto">${sottotitolo}</div>
        ${lavori.map((s) => `${testaLavoro(s)}${htmlLavoro(s)}`).join('<hr>') || '<div class="sotto">Dorme. Si sveglia quando il Capo lo chiama.</div>'}`;
    });
  }

  // ---- Flusso di coscienza -----------------------------------------------------------------------
  function attivaFlusso(on) { document.body.classList.toggle('senza-flusso', !on); $('bFlusso').classList.toggle('on', on); }
  const alternaFlusso = () => attivaFlusso(document.body.classList.contains('senza-flusso'));
  $('chiudiFlusso').onclick = () => attivaFlusso(false);
  $('apriFlusso').onclick = () => attivaFlusso(true);
  $('bFlusso').onclick = alternaFlusso;
  addEventListener('keydown', (e) => {
    if (e.repeat || e.target.closest?.('input,textarea')) return;
    if (e.code === 'KeyL') alternaFlusso();
    if (e.code === 'KeyR') alternaDestra();
  });
  function voce({ nome, colore, tipo, testo, onclick }) {
    const d = document.createElement('div');
    d.className = `voce ${tipo}`; d.style.setProperty('--c', colore);
    d.innerHTML = `<div class="chi">${esc(nome)}<em>${ora()}</em></div><div class="tx">${esc(String(testo || '').slice(0, 220))}</div>`;
    if (onclick) d.onclick = onclick;
    $('coscienza').prepend(d); while ($('coscienza').children.length > 40) $('coscienza').lastChild.remove();
  }

  function ticker(e) {
    const m = e.tipo === 'incarico' ? '#7dd3fc' : coloreAffidabilita(e.affidabilita);
    const d = document.createElement('div'); d.className = 'bst'; d.style.setProperty('--m', m);
    d.innerHTML = `<b>${e.affidabilita != null ? Math.round(e.affidabilita * 100) + '%' : '✉'}</b><span>${esc(nomeDi(e.percorso[0]))} → ${esc(nomeDi(e.percorso.at(-1)))} · ${esc(e.titolo)}</span>`;
    d.onclick = () => apriBusta(e);
    $('ticker').prepend(d); while ($('ticker').children.length > 8) $('ticker').lastChild.remove();
  }

  let timerRich;
  function richiesta(testo) {
    const r = $('richiesta'); r.innerHTML = `<b>RICHIESTA AL CAPO</b>${esc(testo)}`; r.style.opacity = 1;
    clearTimeout(timerRich); timerRich = setTimeout(() => { r.style.opacity = 0.35; }, 12000);
  }
  function posizione(e) {
    const rep = azienda.reparti.find((r) => r.id === e.reparto);
    const t = document.createElement('div'); t.className = 'posizione pannello';
    t.innerHTML = `<h3 class="tit">Posizione aperta <span>${esc(rep?.nome || e.reparto)}</span></h3><p><b>${esc(e.ruolo)}</b><br>${esc(e.motivo)}</p><button>Forma il nuovo impiegato</button> <button class="no">Più tardi</button>`;
    t.querySelector('.no').onclick = () => t.remove();
    document.body.appendChild(t); setTimeout(() => t.remove(), 25000);
  }
  function metriche(valori) {
    const k = (v) => (typeof v !== 'number' ? v : v > 999999 ? `${(v / 1e6).toFixed(2)}<small>M</small>` : v > 999 ? `${(v / 1000).toFixed(1)}<small>k</small>` : v);
    $('metriche').innerHTML = valori.map(([i, b]) => `<div class="metrica"><i>${i}</i><b>${k(b)}</b></div>`).join('');
  }

  return { registro, registra, htmlLavoro, testaLavoro, mostraDettaglio, apriBusta, apriLavori, voce, ticker, richiesta, posizione, metriche };
}
