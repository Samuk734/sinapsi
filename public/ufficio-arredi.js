// Arredi realistici e allestimenti a tema per ogni reparto.
// Convenzione: le misure sono in metri, le funzioni posizionano gli oggetti appoggiati a terra (yBase).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { texturaCanvas, lavagna, posterSchema, rumore, insegnaReparto } from './ufficio-schermi.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
export const M = {
  rovere: std('#c9a173', { roughness: 0.55, map: rumore([201, 161, 115], 26, 128, [2, 1]) }),
  laminato: std('#f1efea', { roughness: 0.45 }),
  metalloNero: std('#25282e', { roughness: 0.4, metalness: 0.7 }),
  alluminio: std('#b9bfc8', { roughness: 0.3, metalness: 0.9 }),
  acciaio: std('#d7dbe0', { roughness: 0.22, metalness: 0.95 }),
  plasticaNera: std('#16181c', { roughness: 0.35 }),
  plasticaGrigia: std('#9aa0a8', { roughness: 0.5 }),
  rete: std('#2b2f36', { roughness: 0.85 }),
  tessutoGrigio: std('#6b7079', { roughness: 0.95 }),
  muro: std('#ece9e4', { roughness: 0.9 }),
  vaso: std('#f3f1ec', { roughness: 0.35 }),
  terra: std('#3b2b20', { roughness: 1 }),
  foglia: new THREE.MeshStandardMaterial({ color: '#3f7d3a', roughness: 0.6, side: THREE.DoubleSide }),
  foglia2: new THREE.MeshStandardMaterial({ color: '#2f6b33', roughness: 0.6, side: THREE.DoubleSide }),
  vetro: new THREE.MeshStandardMaterial({ color: '#dcefff', transparent: true, opacity: 0.13, roughness: 0.04, metalness: 0.1, depthWrite: false, envMapIntensity: 1.4 }),
  vetroSatinato: new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, roughness: 0.6, depthWrite: false }),
  schermoSpento: std('#07090d', { roughness: 0.15, metalness: 0.3 }),
  carta: std('#fafaf7', { roughness: 0.9 }),
  pcb: std('#11612f', { roughness: 0.5 }),
  rame: std('#c98a3a', { roughness: 0.35, metalness: 0.9 }),
  granito: std('#2a2c30', { roughness: 0.35, map: rumore([42, 44, 48], 30, 128, [2, 2]) }),
  rosso: std('#b4232a', { roughness: 0.4, metalness: 0.3 }),
  blu: std('#1f4fa8', { roughness: 0.5 }),
  esd: std('#3e6fa8', { roughness: 0.8 }),
  pelle: std('#3a2a22', { roughness: 0.55 }),
};
const emissivo = (c, i = 1) => new THREE.MeshStandardMaterial({ color: '#000', emissive: c, emissiveIntensity: i });

const cacheGeo = new Map();
function geoBox(w, h, d, r = 0) {
  const k = `${w}|${h}|${d}|${r}`;
  if (!cacheGeo.has(k)) cacheGeo.set(k, r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d));
  return cacheGeo.get(k);
}
// parallelepipedo appoggiato su yBase
export function cubo(p, [w, h, d], mat, [x, y, z], { r = 0, ry = 0, rx = 0, ombra = true } = {}) {
  const m = new THREE.Mesh(geoBox(w, h, d, r), mat);
  m.position.set(x, y + h / 2, z); m.rotation.set(rx, ry, 0);
  m.castShadow = ombra; m.receiveShadow = true; p.add(m); return m;
}
export function cil(p, r, h, mat, [x, y, z], { rt = r, seg = 20, rx = 0, rz = 0 } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, r, h, seg), mat);
  m.position.set(x, y + h / 2, z); m.rotation.set(rx, 0, rz); m.castShadow = true; m.receiveShadow = true; p.add(m); return m;
}
const gruppo = (p, x, z, ry = 0, y = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g); return g; };

// ---- Luci intermittenti (LED dei rack, dei banchi prova) --------------------------------------------
export const lucine = [];
function led(p, punti, colori) {
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff' }), punti.length);
  const m = new THREE.Matrix4();
  punti.forEach((q, i) => { m.setPosition(...q); im.setMatrixAt(i, m); im.setColorAt(i, new THREE.Color(colori[i % colori.length])); });
  p.add(im); lucine.push({ im, colori, n: punti.length }); return im;
}
export function aggiornaLucine() {
  const c = new THREE.Color();
  for (const l of lucine) {
    for (let k = 0; k < 3; k++) { const i = (Math.random() * l.n) | 0; c.set(Math.random() < 0.3 ? '#111' : l.colori[(Math.random() * l.colori.length) | 0]); l.im.setColorAt(i, c); }
    l.im.instanceColor.needsUpdate = true;
  }
}

// ---- Mobili ---------------------------------------------------------------------------------------
export function monitor(p, [x, y, z], ry = 0, w = 0.6) {
  const g = gruppo(p, x, z, ry, y), h = w * 0.58;
  cubo(g, [0.22, 0.012, 0.16], M.metalloNero, [0, 0, 0]);
  cubo(g, [0.035, 0.24, 0.025], M.metalloNero, [0, 0, -0.03]);
  cubo(g, [w, h, 0.028], M.plasticaNera, [0, 0.12, 0], { r: 0.006 });
  const schermo = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.025, h - 0.025), M.schermoSpento);
  schermo.position.set(0, 0.12 + h / 2, 0.021); g.add(schermo);
  return schermo;
}

export function sedia(p, x, z, ry = 0) {
  const g = gruppo(p, x, z, ry);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2, b = cubo(g, [0.04, 0.03, 0.3], M.metalloNero, [Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.15], { ry: a });
    b.castShadow = false;
    const r = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), M.plasticaNera); r.position.set(Math.sin(a) * 0.3, 0.025, Math.cos(a) * 0.3); g.add(r);
  }
  cil(g, 0.025, 0.32, M.acciaio, [0, 0.08, 0]);
  cubo(g, [0.5, 0.08, 0.48], M.rete, [0, 0.4, 0.02], { r: 0.035 });
  cubo(g, [0.46, 0.55, 0.05], M.rete, [0, 0.55, -0.25], { r: 0.04, rx: -0.12 });
  cubo(g, [0.2, 0.05, 0.22], M.metalloNero, [0, 0.43, -0.2]);
  for (const s of [-1, 1]) { cubo(g, [0.04, 0.2, 0.04], M.metalloNero, [s * 0.27, 0.44, 0]); cubo(g, [0.06, 0.03, 0.26], M.plasticaNera, [s * 0.27, 0.64, 0.02], { r: 0.012 }); }
  return g;
}

// scrivania: la persona siede dal lato +z locale e guarda verso -z
export function postazione(p, x, z, ry, { colore = '#888', doppio = true, w = 1.6, lampada = Math.random() < 0.4 } = {}) {
  const g = gruppo(p, x, z, ry);
  cubo(g, [w, 0.035, 0.8], M.rovere, [0, 0.72, 0], { r: 0.01 });
  for (const s of [-1, 1]) {
    cubo(g, [0.05, 0.72, 0.05], M.metalloNero, [s * (w / 2 - 0.08), 0, 0.3]); cubo(g, [0.05, 0.72, 0.05], M.metalloNero, [s * (w / 2 - 0.08), 0, -0.3]);
    cubo(g, [0.05, 0.05, 0.62], M.metalloNero, [s * (w / 2 - 0.08), 0.66, 0]);
  }
  cubo(g, [w - 0.2, 0.35, 0.02], M.metalloNero, [0, 0.33, -0.36]);
  const schermi = [];
  if (doppio) { schermi.push(monitor(g, [-0.33, 0.755, -0.22], 0.12, 0.6), monitor(g, [0.33, 0.755, -0.22], -0.12, 0.6)); } else schermi.push(monitor(g, [0, 0.755, -0.22], 0, 0.7));
  cubo(g, [0.44, 0.02, 0.14], M.plasticaGrigia, [0, 0.755, 0.12], { r: 0.006 });
  cubo(g, [0.06, 0.022, 0.1], M.plasticaNera, [0.34, 0.755, 0.14], { r: 0.01 });
  cil(g, 0.04, 0.09, M.vaso, [-0.55, 0.755, 0.1]);
  if (lampada) {
    cil(g, 0.07, 0.02, M.metalloNero, [0.62, 0.755, -0.2]); cubo(g, [0.015, 0.4, 0.015], M.metalloNero, [0.62, 0.77, -0.2], { rx: 0.3 });
    cubo(g, [0.18, 0.04, 0.08], M.metalloNero, [0.62, 1.12, -0.08]); cubo(g, [0.16, 0.01, 0.06], emissivo('#ffe2b0', 2.5), [0.62, 1.115, -0.08]);
  }
  for (let i = 0; i < 2; i++) cubo(g, [0.21, 0.004, 0.297], M.carta, [-0.25 + i * 0.03, 0.758 + i * 0.006, 0.18], { ry: 0.2 * i - 0.1, ombra: false });
  const s = sedia(g, 0, 0.62, Math.PI);
  return { g, schermi, sedia: s, posto: () => g.localToWorld(new THREE.Vector3(0, 0.27, 0.62)), rotazione: ry + Math.PI };
}

export function pianta(p, x, z, s = 1) {
  const g = gruppo(p, x, z);
  cil(g, 0.2 * s, 0.42 * s, M.vaso, [0, 0, 0], { rt: 0.24 * s, seg: 24 });
  cil(g, 0.22 * s, 0.02, M.terra, [0, 0.4 * s, 0]);
  const foglia = new THREE.ShapeGeometry(new THREE.Shape().moveTo(0, 0).bezierCurveTo(0.12, 0.08, 0.1, 0.32, 0, 0.42).bezierCurveTo(-0.1, 0.32, -0.12, 0.08, 0, 0));
  const n = Math.round(16 * s + 6);
  for (let i = 0; i < n; i++) {
    const f = new THREE.Mesh(foglia, i % 2 ? M.foglia : M.foglia2);
    const a = Math.random() * Math.PI * 2, h = (0.45 + Math.random() * 0.9) * s;
    f.position.set(Math.cos(a) * 0.08 * s, h, Math.sin(a) * 0.08 * s);
    f.rotation.set(-0.5 - Math.random() * 0.7, a + Math.PI / 2, (Math.random() - 0.5) * 0.4);
    f.scale.setScalar((0.8 + Math.random() * 0.7) * s); f.castShadow = true; g.add(f);
  }
  cil(g, 0.012 * s, 1.1 * s, M.terra, [0, 0.4 * s, 0]);
  return g;
}

export function scaffale(p, x, z, ry, { w = 1.8, h = 2.0, d = 0.38, ripiani = 5, contenuto = 'libri' } = {}) {
  const g = gruppo(p, x, z, ry);
  for (const s of [-1, 1]) cubo(g, [0.025, h, d], M.laminato, [s * w / 2, 0, 0]);
  cubo(g, [w, h, 0.015], M.laminato, [0, 0, -d / 2]);
  const passo = h / ripiani;
  for (let i = 0; i <= ripiani; i++) cubo(g, [w, 0.025, d], M.laminato, [0, i * passo - (i === ripiani ? 0.025 : 0), 0]);
  // contenuto con istanze
  const colori = { libri: ['#7c2d12', '#1e3a8a', '#065f46', '#78350f', '#334155', '#9f1239', '#eab308'], faldoni: ['#1d4ed8', '#dc2626', '#16a34a', '#facc15', '#7c3aed', '#0f172a'], pcb: ['#11612f', '#0b4f8a', '#11612f'], parti: ['#c0c6cf', '#9aa1aa', '#c98a3a'], scatole: ['#c8a46e', '#b8925a'] }[contenuto] || ['#888'];
  const pezzi = [];
  for (let i = 0; i < ripiani; i++) {
    let px = -w / 2 + 0.05;
    while (px < w / 2 - 0.12) {
      const t = contenuto === 'faldoni' ? 0.08 : contenuto === 'pcb' ? 0.16 : contenuto === 'parti' ? 0.14 : contenuto === 'scatole' ? 0.34 : 0.03 + Math.random() * 0.03;
      const hh = contenuto === 'pcb' ? 0.012 : contenuto === 'parti' ? 0.08 + Math.random() * 0.1 : contenuto === 'scatole' ? 0.24 : passo * (0.6 + Math.random() * 0.25);
      if (Math.random() > 0.12) pezzi.push([px + t / 2, i * passo + 0.025 + hh / 2, 0, t, hh, contenuto === 'pcb' ? 0.1 : d * 0.8]);
      px += t + (contenuto === 'libri' ? 0.004 : 0.02);
    }
  }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std('#fff', { roughness: 0.6 }), pezzi.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  pezzi.forEach(([a, b, cz, sx, sy, sz], i) => { m.compose(new THREE.Vector3(a, b, cz), q, new THREE.Vector3(sx, sy, sz)); im.setMatrixAt(i, m); im.setColorAt(i, c.set(colori[i % colori.length]).offsetHSL(0, 0, (Math.random() - 0.5) * 0.08)); });
  im.castShadow = true; im.receiveShadow = true; g.add(im);
  return g;
}

export function quadroParete(p, [x, y, z], ry, [w, h], tex, cornice = M.alluminio) {
  const g = gruppo(p, x, z, ry, y);
  cubo(g, [w + 0.06, h + 0.06, 0.03], cornice, [0, -h / 2 - 0.03, 0]);
  const pannello = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }));
  pannello.position.set(0, 0, 0.024); g.add(pannello);
  return pannello;
}

export function tv(p, [x, y, z], ry, w = 1.5) {
  const g = gruppo(p, x, z, ry, y), h = w * 0.5625;
  cubo(g, [w + 0.04, h + 0.04, 0.05], M.plasticaNera, [0, -h / 2 - 0.02, 0], { r: 0.008 });
  const schermo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.schermoSpento); schermo.position.z = 0.036; g.add(schermo);
  return schermo;
}

function divano(p, x, z, ry, colore = '#4b5563', w = 2.0) {
  const g = gruppo(p, x, z, ry), t = std(colore, { roughness: 0.95 });
  cubo(g, [w, 0.42, 0.85], t, [0, 0.08, 0], { r: 0.06 }); cubo(g, [w, 0.45, 0.2], t, [0, 0.4, -0.33], { r: 0.07 });
  for (const s of [-1, 1]) cubo(g, [0.18, 0.62, 0.85], t, [s * (w / 2 - 0.09), 0.08, 0], { r: 0.06 });
  for (const s of [-1, 1]) for (const k of [-1, 1]) cil(g, 0.02, 0.08, M.metalloNero, [s * (w / 2 - 0.1), 0, k * 0.35]);
  return g;
}
function poltrona(p, x, z, ry, colore = '#7c4a2d') { return divano(p, x, z, ry, colore, 0.95); }
function tavolo(p, x, z, ry, [w, d], mat = M.rovere, h = 0.74) {
  const g = gruppo(p, x, z, ry);
  cubo(g, [w, 0.04, d], mat, [0, h - 0.04, 0], { r: 0.01 });
  for (const s of [-1, 1]) for (const k of [-1, 1]) cubo(g, [0.05, h - 0.04, 0.05], M.metalloNero, [s * (w / 2 - 0.1), 0, k * (d / 2 - 0.1)]);
  return g;
}

// ---- Strumenti e attrezzature ------------------------------------------------------------------------
function rack(p, x, z, ry, h = 2.0) {
  const g = gruppo(p, x, z, ry);
  cubo(g, [0.6, h, 0.9], M.metalloNero, [0, 0, 0], { r: 0.01 });
  const pts = [];
  for (let u = 0; u < 14; u++) { cubo(g, [0.54, 0.09, 0.02], M.plasticaGrigia, [0, 0.15 + u * 0.125, 0.455]); for (let k = 0; k < 6; k++) pts.push([-0.22 + k * 0.035, 0.2 + u * 0.125, 0.468]); }
  led(g, pts, ['#22c55e', '#22c55e', '#38bdf8', '#f59e0b']);
  return g;
}
function bancoLab(p, x, z, ry, w = 2.2) {
  const g = gruppo(p, x, z, ry);
  cubo(g, [w, 0.04, 0.85], M.laminato, [0, 0.86, 0]); cubo(g, [w - 0.02, 0.004, 0.8], M.esd, [0, 0.9, 0]);
  for (const s of [-1, 1]) cubo(g, [0.06, 0.86, 0.75], M.alluminio, [s * (w / 2 - 0.05), 0, 0]);
  cubo(g, [w, 0.03, 0.3], M.alluminio, [0, 1.45, -0.3]); for (const s of [-1, 1]) cubo(g, [0.04, 0.6, 0.04], M.alluminio, [s * (w / 2 - 0.05), 0.9, -0.38]);
  return g;
}
function oscilloscopio(p, [x, y, z], ry = 0) {
  const g = gruppo(p, x, z, ry, y);
  cubo(g, [0.42, 0.22, 0.16], std('#d1d5db', { roughness: 0.4 }), [0, 0, 0], { r: 0.015 });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.15), M.schermoSpento); s.position.set(-0.07, 0.11, 0.088); g.add(s);
  for (let i = 0; i < 6; i++) cil(g, 0.012, 0.015, M.plasticaNera, [0.1 + (i % 2) * 0.06, 0.05 + Math.floor(i / 2) * 0.05, 0.08], { rx: Math.PI / 2 });
  return s;
}
function alimentatore(p, [x, y, z], ry = 0) {
  const g = gruppo(p, x, z, ry, y);
  cubo(g, [0.26, 0.15, 0.3], std('#e5e7eb'), [0, 0, 0], { r: 0.01 });
  cubo(g, [0.08, 0.035, 0.005], emissivo('#ef4444', 2), [-0.06, 0.09, 0.152]); cubo(g, [0.08, 0.035, 0.005], emissivo('#22c55e', 2), [0.06, 0.09, 0.152]);
}
function saldatore(p, [x, y, z]) {
  const g = gruppo(p, x, z, 0, y);
  cubo(g, [0.16, 0.1, 0.18], std('#1f2937'), [0, 0, 0], { r: 0.01 }); cubo(g, [0.05, 0.02, 0.003], emissivo('#f97316', 2.5), [0, 0.06, 0.091]);
  cil(g, 0.01, 0.16, M.acciaio, [0.14, 0.03, 0.02], { rz: 0.9 });
}
function microscopio(p, [x, y, z], ry = 0) {
  const g = gruppo(p, x, z, ry, y);
  cubo(g, [0.22, 0.03, 0.26], M.plasticaNera, [0, 0, 0]); cubo(g, [0.05, 0.38, 0.05], M.plasticaNera, [0, 0, -0.08]);
  cil(g, 0.04, 0.14, M.plasticaGrigia, [0, 0.22, 0], { rx: 0.4 }); cil(g, 0.018, 0.08, M.plasticaNera, [0, 0.36, 0.06], { rx: -0.5 });
}
function schedaPCB(p, [x, y, z], ry = 0, w = 0.16, d = 0.1) {
  const g = gruppo(p, x, z, ry, y);
  cubo(g, [w, 0.006, d], M.pcb, [0, 0, 0]);
  for (let i = 0; i < 6; i++) cubo(g, [0.02 + Math.random() * 0.02, 0.008, 0.015 + Math.random() * 0.02], i % 3 ? M.plasticaNera : M.rame, [(Math.random() - 0.5) * w * 0.8, 0.006, (Math.random() - 0.5) * d * 0.8], { ombra: false });
}
function plotter(p, x, z, ry) {
  const g = gruppo(p, x, z, ry);
  for (const s of [-1, 1]) cubo(g, [0.08, 0.85, 0.5], M.plasticaNera, [s * 0.75, 0, 0]);
  cubo(g, [1.7, 0.32, 0.52], std('#e5e7eb', { roughness: 0.35 }), [0, 0.85, 0], { r: 0.04 });
  cubo(g, [1.4, 0.004, 0.6], M.carta, [0, 0.8, 0.45], { rx: 0.5, ombra: false });
}
function stampante3D(p, [x, y, z]) {
  const g = gruppo(p, x, z, 0, y);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cubo(g, [0.03, 0.5, 0.03], M.metalloNero, [a * 0.22, 0, b * 0.22]);
  cubo(g, [0.48, 0.03, 0.48], M.metalloNero, [0, 0.5, 0]); cubo(g, [0.42, 0.02, 0.42], std('#111827'), [0, 0.06, 0]);
  cil(g, 0.07, 0.12, std('#f97316', { roughness: 0.5 }), [0, 0.08, 0], { seg: 6 }); cubo(g, [0.06, 0.05, 0.06], emissivo('#38bdf8', 1.5), [0.05, 0.3, 0]);
}
function fresa(p, x, z, ry) {
  const g = gruppo(p, x, z, ry), v = std('#5b6b7a', { roughness: 0.45, metalness: 0.4 });
  cubo(g, [0.9, 0.85, 0.7], v, [0, 0, 0], { r: 0.02 }); cubo(g, [0.75, 0.06, 0.5], M.acciaio, [0, 0.85, 0.05]);
  cubo(g, [0.25, 1.1, 0.25], v, [0, 0.85, -0.25], { r: 0.02 }); cubo(g, [0.28, 0.35, 0.4], v, [0, 1.55, -0.05], { r: 0.03 });
  cil(g, 0.03, 0.2, M.acciaio, [0, 1.35, 0.05]); cubo(g, [0.2, 0.14, 0.02], emissivo('#22d3ee', 1.2), [0.3, 1.25, 0.15], { ry: -0.5 });
}
function cassettiera(p, x, z, ry, mat = M.rosso, cassetti = 6) {
  const g = gruppo(p, x, z, ry);
  cubo(g, [0.7, 1.0, 0.5], mat, [0, 0, 0], { r: 0.01 });
  for (let i = 0; i < cassetti; i++) cubo(g, [0.3, 0.015, 0.02], M.acciaio, [0, 0.1 + i * (0.9 / cassetti), 0.255]);
}
function cassettieraComponenti(p, [x, y, z], ry = 0) {
  const g = gruppo(p, x, z, ry, y);
  cubo(g, [0.6, 0.5, 0.2], std('#cbd5e1'), [0, 0, 0]);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.065, 0.045, 0.01), std('#e0f2fe', { transparent: true, opacity: 0.85 }), 48), m = new THREE.Matrix4();
  for (let i = 0; i < 48; i++) { m.setPosition(-0.26 + (i % 8) * 0.074, 0.04 + Math.floor(i / 8) * 0.075, 0.105); im.setMatrixAt(i, m); }
  g.add(im);
}
function telaioCablaggi(p, x, z, ry) {
  const g = gruppo(p, x, z, ry);
  cubo(g, [2.4, 1.2, 0.04], std('#e8dcc4', { roughness: 0.8 }), [0, 0.7, 0]);
  for (const s of [-1, 1]) cubo(g, [0.06, 1.9, 0.3], M.metalloNero, [s * 1.15, 0, -0.1], { rx: 0.08 });
  const colori = ['#dc2626', '#1d4ed8', '#16a34a', '#111111', '#ca8a04', '#7c3aed', '#f97316'];
  colori.forEach((c, i) => {
    const pts = [new THREE.Vector3(-1.1, 1.75 - i * 0.12, 0.04), new THREE.Vector3(-0.2, 1.75 - i * 0.12, 0.04), new THREE.Vector3(0.1 + i * 0.05, 1.3, 0.04), new THREE.Vector3(0.1 + i * 0.05, 0.9, 0.04), new THREE.Vector3(1.05, 0.85 + i * 0.05, 0.04)];
    const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.009, 6), std(c, { roughness: 0.45 })); t.castShadow = true; g.add(t);
  });
  for (let i = 0; i < 18; i++) cil(g, 0.006, 0.05, M.acciaio, [-1.1 + (i % 6) * 0.42, 0.9 + Math.floor(i / 6) * 0.35, 0.04], { rx: Math.PI / 2 });
}
function bobine(p, x, z, ry) {
  const g = gruppo(p, x, z, ry);
  for (const s of [-1, 1]) cubo(g, [0.05, 1.2, 0.5], M.metalloNero, [s * 0.65, 0, 0]);
  ['#dc2626', '#1d4ed8', '#16a34a', '#ca8a04', '#111', '#f97316'].forEach((c, i) => {
    const b = cil(g, 0.17, 0.18, std(c, { roughness: 0.5 }), [-0.42 + (i % 3) * 0.42, 0.25 + Math.floor(i / 3) * 0.55, 0], { rz: Math.PI / 2 });
    b.position.x += 0.09;
  });
  for (const yy of [0.25, 0.8]) cil(g, 0.02, 1.3, M.acciaio, [0.65, yy + 0.17, 0], { rz: Math.PI / 2 });
}
function quadroElettrico(p, x, z, ry) {
  const g = gruppo(p, x, z, ry), grigio = std('#c9ced6', { roughness: 0.45, metalness: 0.3 });
  cubo(g, [0.8, 1.6, 0.3], grigio, [0, 0.2, 0]); cubo(g, [0.04, 1.6, 0.8], grigio, [0.42, 0.2, 0.4], { ry: 0.0 });
  cubo(g, [0.04, 0.1, 0.04], M.metalloNero, [0, 0.2, 0]);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.09, 0.07), std('#fff'), 36), m = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < 36; i++) { m.setPosition(-0.33 + (i % 12) * 0.06, 0.55 + Math.floor(i / 12) * 0.38, 0.16); im.setMatrixAt(i, m); im.setColorAt(i, c.set(['#e5e7eb', '#e5e7eb', '#1d4ed8', '#facc15', '#16a34a'][i % 5])); }
  g.add(im);
  for (let r = 0; r < 3; r++) cubo(g, [0.7, 0.012, 0.03], M.acciaio, [0, 0.54 + r * 0.38, 0.15]);
}
function pianoGranito(p, x, z, ry) {
  const g = gruppo(p, x, z, ry);
  cubo(g, [0.9, 0.7, 0.6], M.metalloNero, [0, 0, 0]); cubo(g, [1.0, 0.15, 0.7], M.granito, [0, 0.7, 0], { r: 0.01 });
  cubo(g, [0.08, 0.35, 0.08], M.acciaio, [0.25, 0.85, 0]); cubo(g, [0.18, 0.04, 0.06], M.acciaio, [0.32, 1.05, 0]);
  for (let i = 0; i < 4; i++) cil(g, 0.035, 0.05 + i * 0.03, M.acciaio, [-0.3 + i * 0.12, 0.85, 0.15]);
}
function tavoloOttico(p, x, z, ry) {
  const g = gruppo(p, x, z, ry);
  for (const s of [-1, 1]) for (const k of [-1, 1]) cil(g, 0.07, 0.75, M.metalloNero, [s * 0.75, 0, k * 0.4]);
  const fori = texturaCanvas(256, 128, (c, W, H) => { c.fillStyle = '#3b3f46'; c.fillRect(0, 0, W, H); c.fillStyle = '#23262b'; for (let i = 6; i < W; i += 10) for (let j = 6; j < H; j += 10) { c.beginPath(); c.arc(i, j, 1.6, 0, 6.3); c.fill(); } });
  cubo(g, [1.8, 0.1, 1.0], std('#fff', { map: fori, roughness: 0.4, metalness: 0.6 }), [0, 0.75, 0]);
  cubo(g, [0.3, 0.1, 0.1], std('#111827'), [-0.7, 0.85, 0]);
  const raggio = cil(g, 0.004, 1.2, new THREE.MeshBasicMaterial({ color: '#ff2a2a' }), [-0.55, 0.9, 0], { rz: Math.PI / 2 }); raggio.castShadow = false; raggio.position.x = 0.05;
  for (const s of [0.65, -0.1]) cubo(g, [0.05, 0.14, 0.12], M.acciaio, [s, 0.85, 0]);
}
function pendoloNewton(p, [x, y, z]) {
  const g = gruppo(p, x, z, 0, y);
  cubo(g, [0.22, 0.015, 0.12], M.metalloNero, [0, 0, 0]); for (const s of [-1, 1]) cubo(g, [0.01, 0.16, 0.01], M.acciaio, [s * 0.1, 0, 0]);
  cubo(g, [0.21, 0.01, 0.01], M.acciaio, [0, 0.16, 0]);
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), M.acciaio); b.position.set(-0.072 + i * 0.036, 0.06, 0); g.add(b); }
}
function mappamondo(p, x, z) {
  const g = gruppo(p, x, z);
  cil(g, 0.18, 0.04, M.rovere, [0, 0, 0]); cil(g, 0.02, 0.75, M.rovere, [0, 0.04, 0]);
  const tex = texturaCanvas(256, 128, (c, W, H) => { c.fillStyle = '#2f6f9f'; c.fillRect(0, 0, W, H); c.fillStyle = '#d7c49e'; for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(Math.random() * W, 20 + Math.random() * 90, 10 + Math.random() * 30, 6 + Math.random() * 20, 0, 0, 6.3); c.fill(); } });
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 20), std('#fff', { map: tex, roughness: 0.45 })); s.position.y = 1.0; s.rotation.z = 0.4; s.castShadow = true; g.add(s);
}
function fotocopiatrice(p, x, z, ry) {
  const g = gruppo(p, x, z, ry);
  cubo(g, [0.65, 1.0, 0.65], std('#e5e7eb', { roughness: 0.4 }), [0, 0, 0], { r: 0.02 }); cubo(g, [0.6, 0.12, 0.55], std('#d1d5db'), [0, 1.0, 0], { r: 0.02 });
  cubo(g, [0.18, 0.1, 0.02], emissivo('#60a5fa', 1.2), [0.18, 1.0, 0.33], { rx: -0.6 });
  cubo(g, [0.3, 0.04, 0.22], M.carta, [-0.1, 0.8, 0.35]);
}
function cavalletto(p, x, z, ry) {
  const g = gruppo(p, x, z, ry);
  for (const s of [-1, 1]) cubo(g, [0.04, 1.7, 0.04], M.rovere, [s * 0.3, 0, 0], { rx: 0.08 });
  cubo(g, [0.04, 1.6, 0.04], M.rovere, [0, 0, -0.35], { rx: -0.22 });
  const tela = texturaCanvas(256, 320, (c, W, H) => { const gr = c.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#fde68a'); gr.addColorStop(0.5, '#f472b6'); gr.addColorStop(1, '#6366f1'); c.fillStyle = gr; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(W * 0.6, H * 0.35, 40, 0, 6.3); c.fill(); });
  cubo(g, [0.62, 0.78, 0.03], std('#fff', { map: tela, roughness: 0.8 }), [0, 0.85, 0.06], { rx: 0.08 });
}
function campionarioColori(p, [x, y, z], ry) {
  const g = gruppo(p, x, z, ry, y);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.012), std('#fff', { roughness: 0.6 }), 60), m = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < 60; i++) { m.setPosition(-0.95 + (i % 12) * 0.173, 0.1 + Math.floor(i / 12) * 0.18, 0); im.setMatrixAt(i, m); im.setColorAt(i, c.setHSL((i % 12) / 12, 0.65, 0.3 + Math.floor(i / 12) * 0.1)); }
  g.add(im);
}
function postIt(p, [x, y, z], ry, n = 24) {
  const g = gruppo(p, x, z, ry, y);
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.075, 0.075, 0.003), std('#fff', { roughness: 0.9 }), n), m = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < n; i++) { m.makeRotationZ((Math.random() - 0.5) * 0.2); m.setPosition((i % 8) * 0.11 - 0.38 + Math.random() * 0.02, Math.floor(i / 8) * 0.11, 0); im.setMatrixAt(i, m); im.setColorAt(i, c.set(['#fde047', '#f9a8d4', '#7dd3fc', '#86efac'][i % 4])); }
  g.add(im);
}
function forno(p, x, z, ry) {
  const g = gruppo(p, x, z, ry);
  cubo(g, [1.4, 0.9, 0.7], std('#9ca3af', { roughness: 0.4, metalness: 0.5 }), [0, 0, 0], { r: 0.02 });
  cubo(g, [1.0, 0.18, 0.72], std('#4b5563'), [0, 0.9, 0], { r: 0.02 });
  cubo(g, [0.8, 0.08, 0.005], emissivo('#fb923c', 2.2), [0, 0.95, 0.362]);
  cubo(g, [0.18, 0.1, 0.005], emissivo('#22c55e', 1.5), [0.55, 0.7, 0.352]);
}
function lenteLampada(p, [x, y, z]) {
  const g = gruppo(p, x, z, 0, y);
  cil(g, 0.08, 0.03, M.plasticaNera, [0, 0, 0]); cubo(g, [0.02, 0.4, 0.02], M.plasticaNera, [0, 0.03, 0], { rx: 0.5 });
  const anello = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 24), M.plasticaNera); anello.position.set(0, 0.36, 0.2); anello.rotation.x = 1.2; g.add(anello);
  const luce = new THREE.Mesh(new THREE.CircleGeometry(0.08, 24), emissivo('#e0f2fe', 1.4)); luce.position.set(0, 0.355, 0.2); luce.rotation.x = -1.95; g.add(luce);
}
function faldoniTavolo(p, [x, y, z]) {
  const g = gruppo(p, x, z, 0, y);
  for (let i = 0; i < 4; i++) cubo(g, [0.3, 0.06, 0.22], std(['#1d4ed8', '#dc2626', '#16a34a', '#facc15'][i]), [0, i * 0.06, 0], { ry: (Math.random() - 0.5) * 0.3 });
}
function calcolatrice(p, [x, y, z]) { cubo(p, [0.09, 0.015, 0.16], M.plasticaNera, [x, y, z], { r: 0.005 }); cubo(p, [0.07, 0.002, 0.03], emissivo('#a3e635', 0.8), [x, y + 0.016, z - 0.05]); }
function certificato(p, [x, y, z], ry) {
  const tex = texturaCanvas(300, 220, (c, W, H) => { c.fillStyle = '#fffdf5'; c.fillRect(0, 0, W, H); c.strokeStyle = '#b08d3c'; c.lineWidth = 6; c.strokeRect(10, 10, W - 20, H - 20); c.fillStyle = '#1f2937'; c.font = '800 70px Georgia'; c.fillText('CE', W / 2 - 50, H / 2 + 10); c.font = '14px Georgia'; c.fillText('Dichiarazione di conformità UE', 44, H - 40); });
  quadroParete(p, [x, y, z], ry, [0.42, 0.31], tex, std('#3b2b1a'));
}

// ---- Allestimento a tema per reparto --------------------------------------------------------------------
// Coordinate locali della stanza: x da -6.5 a 6.5, z da -4.5 (parete di fondo) a 4.5 (vetrata con porta).
// Zone libere: sinistra x[-6.3,-3.8], destra x[2.8,6.3] z[0.6,4.2], parete di fondo.
export function allestisci(stanza, rep) {
  const s = stanza, c = rep.colore, P = (x, z) => [x, 0.9, z];
  const muro = (x, y, w, h, tex) => quadroParete(s, [x, y, -4.43], 0, [w, h], tex);
  switch (rep.id) {
    case 'software':
      rack(s, -5.6, -3.6, 0); rack(s, -4.9, -3.6, 0); muro(4.2, 2.4, 2.2, 1.2, lavagna('architettura', c));
      divano(s, -5.2, 2.6, Math.PI / 2, '#334155', 1.8); pianta(s, 6.0, 4.0, 1.1); poltrona(s, 4.8, 3.6, -Math.PI / 2, '#7c3aed');
      break;
    case 'web':
      postIt(s, [3.4, 1.1, -4.42], 0, 32); muro(-5.0, 2.4, 2.4, 1.3, lavagna('wireframe', c));
      tavolo(s, 4.6, 2.6, 0, [1.6, 0.8], M.laminato, 1.05); monitor(s, [4.6, 1.05, 2.4], 0, 0.7); pianta(s, -6.0, 4.0, 1.2); divano(s, -5.3, 1.0, Math.PI / 2, '#0ea5e9', 1.6);
      break;
    case 'grafica':
      campionarioColori(s, [3.6, 1.0, -4.42], 0); cavalletto(s, -5.0, 2.8, 0.4); muro(-5.0, 2.4, 2.2, 1.3, lavagna('moodboard', c));
      tavolo(s, 4.6, 2.4, 0, [1.8, 0.9], M.laminato); cubo(s, [0.4, 0.015, 0.28], M.plasticaNera, [4.4, 0.74, 2.4], { r: 0.01 }); pianta(s, 6.0, 4.0, 1.3); pianta(s, -6.1, -3.9, 1.0);
      break;
    case 'reverse':
      bancoLab(s, -5.0, 2.6, Math.PI / 2); oscilloscopio(s, [-4.9, 0.9, 2.9], Math.PI / 2); microscopio(s, [-5.0, 0.9, 1.9], Math.PI / 2); schedaPCB(s, [-4.8, 0.9, 2.3]);
      rack(s, -5.6, -3.6, 0); rack(s, 5.8, 3.4, -Math.PI / 2); cubo(s, [0.3, 0.06, 0.2], std('#111827'), [-4.8, 0.9, 3.4], { r: 0.01 });
      break;
    case 'schematici':
      muro(3.8, 2.5, 1.68, 1.2, posterSchema()); muro(-5.0, 2.5, 1.68, 1.2, posterSchema());
      tavolo(s, 4.6, 2.6, 0, [1.8, 1.0]); cassettieraComponenti(s, [4.6, 0.74, 2.3], 0); scaffale(s, -5.6, 1.5, Math.PI / 2, { w: 2.2, contenuto: 'faldoni' }); pianta(s, 6.0, 4.1, 1.0);
      break;
    case 'pcb':
      scaffale(s, -5.7, 1.0, Math.PI / 2, { w: 2.4, contenuto: 'pcb' }); forno(s, 4.6, 3.4, Math.PI);
      tavolo(s, 4.4, 1.4, 0, [1.6, 0.8]); lenteLampada(s, [4.2, 0.74, 1.5]); schedaPCB(s, [4.6, 0.74, 1.4], 0.3, 0.24, 0.16);
      muro(-4.6, 2.4, 1.68, 1.2, texturaCanvas(840, 600, (g, W, H) => { g.fillStyle = '#0d3b1f'; g.fillRect(0, 0, W, H); g.strokeStyle = '#d4a017'; g.lineWidth = 6; for (let i = 0; i < 30; i++) { g.beginPath(); g.moveTo(Math.random() * W, Math.random() * H); g.lineTo(Math.random() * W, Math.random() * H); g.stroke(); } }));
      break;
    case 'ingegneria':
      muro(3.8, 2.4, 2.4, 1.3, lavagna('formule', c)); scaffale(s, -5.7, 1.2, Math.PI / 2, { w: 2.4, contenuto: 'faldoni' }); scaffale(s, -5.7, -2.4, Math.PI / 2, { w: 1.6, contenuto: 'libri' });
      tavolo(s, 4.6, 2.8, 0, [1.8, 0.9]); calcolatrice(s, [4.3, 0.74, 2.8]); faldoniTavolo(s, [4.9, 0.74, 2.8]); pianta(s, 6.0, 4.0, 1.0);
      break;
    case 'diagnostica': {
      bancoLab(s, -5.0, 2.4, Math.PI / 2, 2.4); bancoLab(s, 4.6, 3.6, Math.PI, 2.6);
      const osc = oscilloscopio(s, [4.0, 0.9, 3.4], Math.PI); s.userData.oscilloscopio = osc;
      alimentatore(s, [4.6, 0.9, 3.4], Math.PI); saldatore(s, [5.3, 0.9, 3.4]); schedaPCB(s, [4.7, 0.9, 3.75], 0.2, 0.2, 0.14);
      oscilloscopio(s, [-4.9, 0.9, 1.8], Math.PI / 2); alimentatore(s, [-4.9, 0.9, 2.6], Math.PI / 2); saldatore(s, [-4.8, 0.9, 3.2]);
      cubo(s, [12.8, 0.004, 8.8], std('#5b6b80', { roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [0, 0.04, 0], { ombra: false });
      break;
    }
    case 'normative':
      for (let i = 0; i < 3; i++) scaffale(s, -5.7, -2.8 + i * 2.0, Math.PI / 2, { w: 1.9, h: 2.2, contenuto: 'faldoni' });
      certificato(s, [3.0, 2.3, -4.43], 0); certificato(s, [3.7, 2.3, -4.43], 0); certificato(s, [4.4, 2.3, -4.43], 0);
      tavolo(s, 4.6, 2.6, 0, [1.8, 1.0]); sedia(s, 4.1, 3.5, Math.PI); sedia(s, 5.1, 3.5, Math.PI); faldoniTavolo(s, [4.6, 0.74, 2.6]);
      break;
    case 'disegno':
      plotter(s, -5.4, 1.0, Math.PI / 2); stampante3D(s, [4.4, 0.74, 2.6]); tavolo(s, 4.6, 2.6, 0, [1.8, 0.9]);
      muro(3.8, 2.4, 1.68, 1.2, texturaCanvas(840, 600, (g, W, H) => { g.fillStyle = '#f8fafc'; g.fillRect(0, 0, W, H); g.strokeStyle = '#1e293b'; g.lineWidth = 3; g.strokeRect(120, 120, 420, 300); g.strokeRect(600, 160, 160, 220); g.beginPath(); g.arc(330, 270, 70, 0, 6.3); g.stroke(); g.font = '20px Consolas'; g.fillStyle = '#1e293b'; g.fillText('140', 300, 100); g.fillText('100', 60, 280); }));
      pianta(s, 6.0, 4.1, 1.0);
      break;
    case 'precisione':
      pianoGranito(s, 4.6, 3.2, Math.PI); fresa(s, -5.2, 2.6, Math.PI / 2); cassettiera(s, -5.6, -0.6, Math.PI / 2);
      scaffale(s, 5.9, 0.9, -Math.PI / 2, { w: 1.4, h: 1.6, ripiani: 4, contenuto: 'parti' });
      cubo(s, [12.8, 0.004, 8.8], std('#8b8f96', { roughness: 0.55, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [0, 0.04, 0], { ombra: false });
      break;
    case 'cablaggi':
      telaioCablaggi(s, -5.3, 1.2, Math.PI / 2); bobine(s, 4.6, 3.6, Math.PI); quadroElettrico(s, 5.7, 1.4, -Math.PI / 2);
      cubo(s, [12.8, 0.004, 8.8], std('#6b7280', { roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [0, 0.04, 0], { ombra: false });
      break;
    case 'ricerca':
      for (let i = 0; i < 3; i++) scaffale(s, -5.7, -2.8 + i * 2.0, Math.PI / 2, { w: 1.9, h: 2.2, contenuto: 'libri' });
      poltrona(s, 4.0, 3.2, Math.PI - 0.4, '#7c4a2d'); poltrona(s, 5.4, 3.2, Math.PI + 0.4, '#7c4a2d'); mappamondo(s, 4.7, 1.6);
      cil(s, 0.25, 0.02, M.metalloNero, [5.9, 0, 2.0]); cil(s, 0.015, 1.6, M.metalloNero, [5.9, 0, 2.0]); cubo(s, [0.3, 0.2, 0.3], emissivo('#ffe2b0', 1.2), [5.9, 1.6, 2.0]);
      break;
    case 'fisica':
      tavoloOttico(s, 4.6, 2.6, 0); muro(-4.8, 2.4, 2.4, 1.3, lavagna('formule', c)); muro(3.8, 2.4, 1.6, 1.0, texturaCanvas(640, 400, (g, W, H) => { for (let x = 0; x < W; x += 8) for (let y = 0; y < H; y += 8) { const v = Math.exp(-(((x - W * 0.5) / 120) ** 2) - (((y - H * 0.5) / 80) ** 2)); g.fillStyle = `hsl(${240 - v * 240},90%,${35 + v * 20}%)`; g.fillRect(x, y, 8, 8); } }));
      pendoloNewton(s, [4.0, 0.85, 2.2]); pianta(s, -6.0, 4.0, 1.1);
      break;
    case 'qualita':
      rack(s, -5.6, 2.6, Math.PI / 2); rack(s, -5.6, 1.9, Math.PI / 2); muro(3.8, 2.4, 2.4, 1.3, lavagna('kanban', c));
      bancoLab(s, 4.6, 3.6, Math.PI, 2.4); for (let i = 0; i < 4; i++) schedaPCB(s, [3.8 + i * 0.5, 0.9, 3.5], Math.random());
      break;
    case 'documentazione':
      fotocopiatrice(s, -5.5, 2.8, Math.PI / 2); scaffale(s, -5.7, 0.4, Math.PI / 2, { w: 2.0, contenuto: 'faldoni' }); scaffale(s, -5.7, -2.4, Math.PI / 2, { w: 1.8, contenuto: 'libri' });
      tavolo(s, 4.6, 2.6, 0, [1.8, 0.9]); for (let i = 0; i < 5; i++) cubo(s, [0.21, 0.05, 0.297], M.carta, [4.2 + (i % 3) * 0.3, 0.74, 2.5 + (i > 2 ? 0.3 : 0)], { ry: Math.random() * 0.3 });
      pianta(s, 6.0, 4.1, 1.0);
      break;
    default: pianta(s, -5.8, 3.8, 1.0);
  }
}

// ---- Architettura della stanza ----------------------------------------------------------------------------
// Pareti: fondo pieno con colore d'accento, gli altri lati in vetro con fascia satinata e insegna.
export function pareti(stanza, rep, { lati = ['sx', 'dx'], W = 13, D = 9, H = 2.75 } = {}) {
  const accento = std(new THREE.Color('#ece9e4').lerp(new THREE.Color(rep.colore), 0.35), { roughness: 0.9 });
  cubo(stanza, [W, H, 0.12], accento, [0, 0, -D / 2]);
  cubo(stanza, [W, 0.1, 0.02], M.metalloNero, [0, 0, -D / 2 + 0.07], { ombra: false });
  const vetrata = (x1, z1, x2, z2, porta) => {
    const L = Math.hypot(x2 - x1, z2 - z1), a = Math.atan2(x2 - x1, z2 - z1) - Math.PI / 2;
    const g = gruppo(stanza, (x1 + x2) / 2, (z1 + z2) / 2, -a);
    const pezzi = porta ? [[-L / 2, porta[0]], [porta[1], L / 2]] : [[-L / 2, L / 2]];
    for (const [a1, a2] of pezzi) {
      const w = a2 - a1, cx = (a1 + a2) / 2;
      const v = new THREE.Mesh(new THREE.PlaneGeometry(w, H - 0.06), M.vetro); v.position.set(cx, H / 2, 0); g.add(v);
      const fascia = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.28), M.vetroSatinato); fascia.position.set(cx, 1.15, 0.025); g.add(fascia);
      cubo(g, [w, 0.05, 0.06], M.alluminio, [cx, 0, 0]); cubo(g, [w, 0.05, 0.06], M.alluminio, [cx, H - 0.05, 0]);
      for (let k = 0; k <= Math.round(w / 1.3); k++) cubo(g, [0.04, H, 0.06], M.alluminio, [a1 + (k * w) / Math.round(w / 1.3), 0, 0], { ombra: false });
    }
    if (porta) {
      cubo(g, [porta[1] - porta[0] + 0.08, 0.12, 0.08], M.alluminio, [(porta[0] + porta[1]) / 2, 2.15, 0]);
      const anta = new THREE.Mesh(new THREE.PlaneGeometry(porta[1] - porta[0] - 0.05, 2.1), M.vetro); anta.position.set(porta[0] + (porta[1] - porta[0]) / 2, 1.05, 0.1); g.add(anta);
      anta.position.x -= (porta[1] - porta[0]) * 0.9; // porta scorrevole, aperta
    }
    return g;
  };
  // fronte con porta e insegna
  const fronte = vetrata(-W / 2, D / 2, W / 2, D / 2, [-W / 2 + 1.0, -W / 2 + 2.5]);
  const ins = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.5), new THREE.MeshStandardMaterial({ map: insegnaReparto(rep.nome, rep.colore), transparent: true, roughness: 0.4 }));
  ins.position.set(1.2, 1.15, 0.045); fronte.add(ins);
  if (lati.includes('sx')) vetrata(-W / 2, -D / 2, -W / 2, D / 2);
  if (lati.includes('dx')) vetrata(W / 2, -D / 2, W / 2, D / 2);
}
