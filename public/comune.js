// Funzioni condivise dalle preview: dati dell'azienda, stream eventi, colori.
export const COLORI_MODELLO = { haiku: '#4ade80', sonnet: '#60a5fa', opus: '#c084fc', fable: '#fbbf24', mythos: '#f87171' };

export function coloreModello(m) {
  const k = Object.keys(COLORI_MODELLO).find((x) => String(m || '').includes(x));
  return k ? COLORI_MODELLO[k] : '#cbd5e1';
}

export function coloreAffidabilita(a) {
  if (a == null) return '#94a3b8';
  return a >= 0.8 ? '#34d399' : a >= 0.6 ? '#fbbf24' : '#f87171';
}

export async function caricaAzienda() {
  return (await fetch('/api/azienda')).json();
}

export function collegaStream({ replay, evento }) {
  const es = new EventSource('/stream');
  es.addEventListener('replay', (e) => replay(JSON.parse(e.data)));
  es.onmessage = (e) => evento(JSON.parse(e.data));
  return es;
}

export function demo(on) {
  return fetch('/api/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on }) }).then((r) => r.json());
}

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
