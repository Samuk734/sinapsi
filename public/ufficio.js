// Sinapsi · ufficio v2: piano uffici realistico con reparti a tema, mini Claude e schermi dal vivo.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { caricaAzienda, collegaStream, demo, coloreModello, coloreAffidabilita, esc } from './comune.js';
import { creaPannelli } from './pannelli.js';
import { M, cubo, cil, postazione, pianta, sedia, tv, allestisci, pareti, aggiornaLucine, scaffale } from './ufficio-arredi.js';
import { texturaCanvas, parquet, rumore, disegnaSchermo, disegnaTV, SCHERMO_BLOCCO } from './ufficio-schermi.js';
import { Omino } from './ufficio-omini.js';

// ===== Motore ============================================================================================
const cont = document.getElementById('scena');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
cont.appendChild(renderer.domElement);
const etichette = new CSS2DRenderer(); etichette.setSize(innerWidth, innerHeight); etichette.domElement.className = 'etichette'; cont.appendChild(etichette.domElement);

const scena = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scena.environmentIntensity = 0.42;

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.3, 900);
camera.position.set(46, 44, 74);

const rt = new THREE.WebGLRenderTarget(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio(), { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scena, camera));
const ao = new GTAOPass(scena, camera, innerWidth, innerHeight);
ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1.1, samples: 16 });
// il prepasso dell'AO non deve vedere vetri, insegne trasparenti e cielo: creerebbero ombre fantasma che tremolano
const visibilitaAO = ao.overrideVisibility.bind(ao);
ao.overrideVisibility = () => {
  visibilitaAO();
  scena.traverse((o) => { if ((o.isMesh && o.material?.transparent) || o === cielo) o.visible = false; });
};
composer.addPass(ao);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.32, 0.4, 0.88));
composer.addPass(new OutputPass());
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); etichette.setSize(innerWidth, innerHeight);
});

// ===== Luce del tramonto e cielo ===================================================================================
scena.add(new THREE.HemisphereLight('#c9d8ff', '#4a3a2c', 0.6));
const riempimento = new THREE.DirectionalLight('#e8efff', 0.55); riempimento.position.set(10, 60, 30); scena.add(riempimento);
const sole = new THREE.DirectionalLight('#ffbf86', 3.0);
sole.position.set(-70, 38, -28); sole.castShadow = true;
sole.shadow.mapSize.set(4096, 4096);
Object.assign(sole.shadow.camera, { left: -52, right: 52, top: 52, bottom: -52, near: 1, far: 220 });
sole.shadow.bias = -0.0003; sole.shadow.normalBias = 0.03;
scena.add(sole);

const cielo = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSole: { value: sole.position.clone().normalize() } },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 uSole; varying vec3 vD;
    void main(){ float h = vD.y; vec3 zenit = vec3(0.07, 0.10, 0.26), alto = vec3(0.30, 0.28, 0.52), orizz = vec3(1.0, 0.56, 0.36), basso = vec3(0.13, 0.11, 0.18);
      vec3 c = h > 0.0 ? mix(orizz, alto, smoothstep(0.0, 0.25, h)) : mix(orizz, basso, smoothstep(0.0, -0.12, h));
      c = mix(c, zenit, smoothstep(0.25, 0.9, h));
      float s = max(dot(normalize(vD), uSole), 0.0); c += vec3(1.0, 0.65, 0.35) * pow(s, 18.0) * 0.8 + vec3(1.0, 0.9, 0.7) * pow(s, 600.0) * 4.0;
      gl_FragColor = vec4(c, 1.0); }`,
}));
scena.add(cielo);

// ===== Edificio ==========================================================================================================
const statico = new THREE.Group(); scena.add(statico);
const X0 = -32, X1 = 32, Z0 = -40, Z1 = 34, H = 3.2;
const COLONNE_X = [-25, -9, 9, 25], RIGHE_Z = [-22.5, -10.5, 1.5, 13.5], W = 13, D = 9;
const corridoioDi = (riga) => RIGHE_Z[riga] + D / 2 + 1.5;

const pavimentoLegno = new THREE.MeshStandardMaterial({ map: parquet(), roughness: 0.42, metalness: 0.0 });
const marmo = new THREE.MeshStandardMaterial({ map: rumore([150, 148, 144], 12, 256, [14, 6]), roughness: 0.25, metalness: 0.05 });
const rivestimento = new THREE.MeshStandardMaterial({ map: rumore([62, 66, 76], 10, 256, [4, 1]), roughness: 0.55, metalness: 0.35 });
const cemento = new THREE.MeshStandardMaterial({ map: rumore([168, 166, 160], 20, 256, [1, 2]), roughness: 0.85 });
const montante = new THREE.MeshStandardMaterial({ color: '#2a2e35', roughness: 0.35, metalness: 0.7 });

function costruisciEdificio() {
  cubo(statico, [X1 - X0 + 2, 0.4, Z1 - Z0 + 2], cemento, [0, -0.46, (Z0 + Z1) / 2]);
  const legno = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - Z0 - 12.5), pavimentoLegno);
  legno.rotation.x = -Math.PI / 2; legno.position.set(0, 0, (Z0 + 21.5) / 2); legno.receiveShadow = true; statico.add(legno);
  const hall = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, Z1 - 21.5), marmo);
  hall.rotation.x = -Math.PI / 2; hall.position.set(0, 0, (21.5 + Z1) / 2); hall.receiveShadow = true; statico.add(hall);

  // facciata continua in vetro con montanti
  const facciata = (x1, z1, x2, z2) => {
    const L = Math.hypot(x2 - x1, z2 - z1), n = Math.round(L / 1.6), lungoZ = Math.abs(x2 - x1) < 0.01;
    const v = new THREE.Mesh(new THREE.PlaneGeometry(L, H), M.vetro);
    v.position.set((x1 + x2) / 2, H / 2, (z1 + z2) / 2); v.rotation.y = lungoZ ? Math.PI / 2 : 0; scena.add(v);
    for (let i = 0; i <= n; i++) { const k = i / n; cubo(statico, [0.08, H, 0.14], montante, [x1 + (x2 - x1) * k, 0, z1 + (z2 - z1) * k]); }
    for (const y of [0, 1.05, H - 0.1]) cubo(statico, lungoZ ? [0.1, 0.08, L] : [L, 0.08, 0.1], montante, [(x1 + x2) / 2, y, (z1 + z2) / 2]);
  };
  facciata(X0, Z0, X1, Z0); facciata(X0, Z0, X0, Z1); facciata(X1, Z0, X1, Z1); facciata(X0, Z1, -9, Z1); facciata(9, Z1, X1, Z1);
  for (const x of [-17, 17]) for (const z of [-28.5, -16.5, -4.5, 7.5, 19.5]) cil(statico, 0.32, H, cemento, [x, 0, z], { seg: 24 });

  // nucleo ascensori
  cubo(statico, [18, H, 3.2], rivestimento, [0, 0, Z1 - 1.6]);
  for (const x of [-12, 12]) cubo(statico, [0.4, H, 0.4], M.metalloNero, [x, 0, Z1 - 3.4]);
  const logo = texturaCanvas(1024, 256, (g, w, h) => { g.fillStyle = '#16181d'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffcf73'; g.beginPath(); g.arc(150, h / 2, 46, 0, 6.3); g.fill(); g.fillStyle = '#f3f4f6'; g.font = '800 120px "Segoe UI"'; g.fillText('SINAPSI HQ', 240, h / 2 + 42); });
  const l = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshStandardMaterial({ map: logo, emissive: '#ffffff', emissiveMap: logo, emissiveIntensity: 0.6, roughness: 0.3 }));
  l.rotation.y = Math.PI; l.position.set(0, 2.85, Z1 - 3.4); scena.add(l);
}

// ascensori: porte scorrevoli in acciaio, apertura animata
const ascensori = [-5, 0, 5].map((x) => {
  const g = new THREE.Group(); g.position.set(x, 0, Z1 - 3.25); scena.add(g);
  cubo(g, [2.0, 2.5, 0.12], M.acciaio, [0, 0, 0.02]);
  const ante = [-1, 1].map((s) => { const a = cubo(g, [0.62, 2.2, 0.05], new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 1, roughness: 0.18 }), [s * 0.31, 0, -0.05]); a.userData.s = s; return a; });
  const spia = cubo(g, [0.3, 0.06, 0.02], new THREE.MeshStandardMaterial({ color: '#000', emissive: '#7dd3fc', emissiveIntensity: 0.4 }), [0, 2.36, -0.07]);
  return { g, x, ante, spia, apertura: 0, apriFino: 0 };
});

// tornelli: la timbratrice. Ante in vetro che si aprono, LED di stato
const tornelli = [-3.2, 0, 3.2].map((x) => {
  const g = new THREE.Group(); g.position.set(x, 0, 21.5); scena.add(g);
  for (const s of [-1, 1]) {
    cubo(g, [0.22, 1.0, 1.5], new THREE.MeshStandardMaterial({ color: '#d9dde3', metalness: 0.9, roughness: 0.25 }), [s * 0.62, 0, 0], { r: 0.03 });
    cubo(g, [0.2, 0.02, 1.46], M.plasticaNera, [s * 0.62, 1.0, 0]);
  }
  const led = cubo(g, [0.16, 0.012, 0.22], new THREE.MeshStandardMaterial({ color: '#000', emissive: '#e5e7eb', emissiveIntensity: 0.8 }), [0.62, 1.02, 0.45]);
  const ante = [-1, 1].map((s) => { const a = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.8), M.vetroSatinato); a.position.set(s * 0.31, 0.75, 0); a.rotation.y = Math.PI / 2; g.add(a); return a; });
  return { g, x, led, ante, aperto: 0, timbra: 0, colore: '#22c55e' };
});

function hallEArredi() {
  const banco = new THREE.Group(); banco.position.set(14, 0, 27.5); statico.add(banco);
  cubo(banco, [4.2, 1.1, 0.9], M.laminato, [0, 0, 0], { r: 0.05 }); cubo(banco, [4.4, 0.05, 1.1], M.rovere, [0, 1.1, 0], { r: 0.02 });
  cubo(banco, [4.2, 0.08, 0.02], new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffcf73', emissiveIntensity: 1.5 }), [0, 0.1, 0.46]);
  for (const x of [-14, -20]) { const d = new THREE.Group(); d.position.set(x, 0, 27); statico.add(d); cubo(d, [2.2, 0.42, 0.9], M.tessutoGrigio, [0, 0.1, 0], { r: 0.08 }); cubo(d, [2.2, 0.45, 0.22], M.tessutoGrigio, [0, 0.45, -0.34], { r: 0.08 }); }
  cubo(statico, [1.2, 0.4, 0.7], M.rovere, [-17, 0, 28.6], { r: 0.04 });
  for (const [x, z, s] of [[-9.8, 31.5, 1.4], [9.8, 31.5, 1.4], [-25, 31, 1.6], [25, 31, 1.6], [-30.5, 23, 1.2], [30.5, 23, 1.2], [6, 23.5, 0.9], [-6, 23.5, 0.9]]) pianta(statico, x, z, s);
  for (const z of [-12.5, -0.5, 11.5]) { cubo(statico, [1.0, 0.45, 3.0], M.rovere, [0, 0, z], { r: 0.03 }); pianta(statico, 0, z - 2.4, 0.9); pianta(statico, 0, z + 2.4, 0.9); }
}

// direzione, cucina e sala riunioni sul lato nord
const capo = {};
function lineaNord() {
  const cz = -35.5, g = new THREE.Group(); g.position.set(0, 0, cz); statico.add(g);
  cubo(g, [18, 0.025, 9], new THREE.MeshStandardMaterial({ map: rumore([60, 62, 70], 12, 256, [6, 3]), roughness: 0.9 }), [0, 0, 0], { ombra: false });
  for (const [w, x, z, ry] of [[18, 0, 4.5, 0], [9, -9, 0, Math.PI / 2], [9, 9, 0, Math.PI / 2]]) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(w, H - 0.2), M.vetro); v.position.set(x, (H - 0.2) / 2, z); v.rotation.y = ry; g.add(v);
  }
  cubo(g, [18, 0.06, 0.08], M.alluminio, [0, H - 0.25, 4.5]);
  const scr = new THREE.Group(); scr.position.set(0, 0, -1.2); g.add(scr);
  const noce = new THREE.MeshStandardMaterial({ color: '#4a3324', roughness: 0.35 }), noceScuro = new THREE.MeshStandardMaterial({ color: '#3a281c', roughness: 0.5 });
  cubo(scr, [3.2, 0.06, 1.2], noce, [0, 0.72, 0], { r: 0.02 });
  cubo(scr, [3.0, 0.72, 0.06], noceScuro, [0, 0, -0.4]);
  for (const s of [-1, 1]) cubo(scr, [0.08, 0.72, 1.1], noceScuro, [s * 1.5, 0, 0]);
  capo.schermoPC = tvMonitor(scr, [0, 0.78, -0.3]);
  sedia(scr, 0, -1.0, 0);
  capo.posto = new THREE.Vector3(0, 0.27, cz - 2.2);
  capo.tv = tv(g, [0, 1.75, -4.42], 0, 3.6);
  for (const x of [-6.5, 6.5]) { const d = new THREE.Group(); d.position.set(x, 0, 1.5); d.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(d); cubo(d, [2.4, 0.42, 0.9], M.pelle, [0, 0.1, 0], { r: 0.08 }); cubo(d, [2.4, 0.45, 0.22], M.pelle, [0, 0.45, -0.34], { r: 0.08 }); }
  cubo(g, [1.2, 0.38, 0.8], M.rovere, [0, 0, 2.0], { r: 0.03 });
  scaffale(g, -7.6, -3.9, 0, { w: 2.2, h: 2.2, contenuto: 'libri' }); pianta(g, 8.2, -3.8, 1.4); pianta(g, -8.2, 3.6, 1.2);
  // cucina
  const k = new THREE.Group(); k.position.set(-21.5, 0, -35.5); statico.add(k);
  cubo(k, [10, 0.9, 0.7], M.laminato, [0, 0, -4.0]); cubo(k, [10, 0.04, 0.72], M.granito, [0, 0.9, -4.0]);
  cubo(k, [0.8, 2.0, 0.7], M.acciaio, [5.4, 0, -4.0], { r: 0.02 });
  cubo(k, [0.45, 0.5, 0.4], M.metalloNero, [-2, 0.94, -4.0], { r: 0.03 }); cubo(k, [0.1, 0.05, 0.01], new THREE.MeshStandardMaterial({ color: '#000', emissive: '#22d3ee', emissiveIntensity: 1.5 }), [-2, 1.25, -3.79]);
  for (const x of [-3, 0, 3]) { cil(k, 0.45, 0.04, M.rovere, [x, 0.72, 0.5]); cil(k, 0.04, 0.72, M.metalloNero, [x, 0, 0.5]); for (const a of [0, 2.1, 4.2]) cil(k, 0.2, 0.45, M.tessutoGrigio, [x + Math.cos(a) * 0.75, 0, 0.5 + Math.sin(a) * 0.75]); }
  pianta(k, 4.5, 2.8, 1.3);
  // sala riunioni
  const r = new THREE.Group(); r.position.set(21.5, 0, -35.5); statico.add(r);
  cubo(r, [6, 0.05, 1.8], M.rovere, [0, 0.72, 0], { r: 0.02 }); cubo(r, [5, 0.72, 0.6], M.metalloNero, [0, 0, 0]);
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) sedia(r, -2.4 + i * 1.2, s * 1.3, s > 0 ? Math.PI : 0);
  tv(r, [0, 1.7, -4.4], 0, 2.6);
  for (const x of [-9.5, 9.5]) { const v = new THREE.Mesh(new THREE.PlaneGeometry(9, H - 0.2), M.vetro); v.position.set(x, (H - 0.2) / 2, 0); v.rotation.y = Math.PI / 2; r.add(v); }
}
function tvMonitor(p, [x, y, z]) {
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  cubo(g, [0.3, 0.012, 0.2], M.metalloNero, [0, 0, 0]); cubo(g, [0.04, 0.3, 0.03], M.metalloNero, [0, 0, -0.05]);
  cubo(g, [1.0, 0.5, 0.03], M.plasticaNera, [0, 0.18, 0], { r: 0.006 });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.97, 0.47), M.schermoSpento); s.position.set(0, 0.43, 0.024); g.add(s); return s;
}

// ===== Reparti ==============================================================================================================
const stanze = new Map();
const insegne = [];
function costruisciReparti(azienda) {
  azienda.reparti.forEach((rep, i) => {
    const riga = 3 - Math.floor(i / 4), col = i % 4, cx = COLONNE_X[col], cz = RIGHE_Z[riga];
    const s = new THREE.Group(); s.position.set(cx, 0, cz); statico.add(s);
    const moquette = new THREE.MeshStandardMaterial({ map: rumore([96, 99, 106], 22, 256, [5, 4]), roughness: 0.95, color: new THREE.Color('#ffffff').lerp(new THREE.Color(rep.colore), 0.18) });
    cubo(s, [W - 0.1, 0.025, D - 0.1], moquette, [0, 0, 0], { ombra: false });
    pareti(s, rep, { lati: col === 0 ? ['dx'] : col === 3 ? ['sx'] : ['sx', 'dx'], W, D });

    const bx = -1.0;
    const posti = [
      postazione(s, bx - 0.82, 1.15, 0, { colore: rep.colore }), postazione(s, bx + 0.82, 1.15, 0, { colore: rep.colore }),
      postazione(s, bx - 0.82, 0.25, Math.PI, { colore: rep.colore }), postazione(s, bx + 0.82, 0.25, Math.PI, { colore: rep.colore }),
    ];
    cubo(s, [3.3, 0.36, 0.04], new THREE.MeshStandardMaterial({ color: new THREE.Color(rep.colore).lerp(new THREE.Color('#6b7079'), 0.55), roughness: 0.95 }), [bx, 0.755, 0.7]);
    const capoP = postazione(s, 3.6, -2.4, Math.PI, { colore: rep.colore, w: 1.8, lampada: true });
    const schermoTv = tv(s, [bx, 1.95, -4.43], 0, 2.0);
    allestisci(s, rep);
    s.updateMatrixWorld(true);
    const percorsi = [
      [[-4.75, 2.9], [bx - 0.82, 2.9]], [[-4.75, 2.9], [bx + 0.82, 2.9]],
      [[-4.75, 2.9], [-3.3, 2.9], [-3.3, -1.3], [bx - 0.82, -1.3]], [[-4.75, 2.9], [-3.3, 2.9], [-3.3, -1.3], [bx + 0.82, -1.3]],
    ];
    for (const m of [...posti.flatMap((p) => p.schermi), ...capoP.schermi, schermoTv]) m.userData.dinamico = true;
    stanze.set(rep.id, {
      rep, cx, cz, riga, tv: schermoTv,
      posti: posti.map((p, k) => ({ posto: p.posto(), rotazione: p.rotazione, schermi: p.schermi, libero: true, via: percorsi[k].map(([x, z]) => new THREE.Vector3(cx + x, 0, cz + z)) })),
      capo: { posto: capoP.posto(), rotazione: capoP.rotazione, schermi: capoP.schermi },
    });
    const d = document.createElement('div'); d.className = 'insegna'; d.style.setProperty('--c', rep.colore); d.textContent = rep.nome;
    d.onclick = () => volaA(new THREE.Vector3(cx, 0, cz), 16);
    const o = new CSS2DObject(d); o.position.set(cx, 3.6, cz); scena.add(o); insegne.push(o);
  });
}

// Unisce la geometria statica per materiale: migliaia di oggetti diventano poche decine di draw call
function fondiStatici() {
  statico.updateMatrixWorld(true);
  const gruppi = new Map(), via = [];
  statico.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.material.transparent || o.userData.dinamico || Array.isArray(o.material) || !o.geometry.index) return;
    const g = o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv || !g.attributes.normal) return;
    g.applyMatrix4(o.matrixWorld);
    const k = `${o.material.uuid}|${o.castShadow}`;
    if (!gruppi.has(k)) gruppi.set(k, { mat: o.material, ombra: o.castShadow, geos: [] });
    gruppi.get(k).geos.push(g); via.push(o);
  });
  for (const o of via) o.removeFromParent();
  for (const { mat, ombra, geos } of gruppi.values()) {
    const m = new THREE.Mesh(mergeGeometries(geos, false), mat); m.castShadow = ombra; m.receiveShadow = true; statico.add(m);
  }
  return { oggetti: via.length, gruppi: gruppi.size };
}

// ===== Schermi dal vivo ================================================================================================
const BLOCCO = new THREE.MeshBasicMaterial({ map: SCHERMO_BLOCCO, color: '#8a8fa0' });
class Schermo {
  constructor(meshes, w, h) {
    this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h; this.g = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex });
    this.meshes = meshes; for (const m of meshes) m.material = this.mat;
  }
  spegni() { for (const m of this.meshes) m.material = BLOCCO; }
}
const ICONE = { pensiero: '◆', testo: '✎', strumento: '▶', risultato: '↳' };
const COLORI_RIGA = { pensiero: '#c4b5fd', testo: '#e5e7eb', strumento: '#67e8f9', risultato: '#94a3b8' };

// ===== Personaggi ==========================================================================================================
const impiegati = new Map();
const capiReparto = new Map();
const omini = new Set();
let capoOm;

function bolla(om, y = 1.48) {
  const d = document.createElement('div'); d.className = 'nuvola';
  const o = new CSS2DObject(d); o.position.y = y; o.visible = false; om.g.add(o);
  d.onclick = (e) => { e.stopPropagation(); om.onClic?.(); };
  return { d, o, dici(testo, colore, pensa = true) { o.visible = !!testo; d.style.setProperty('--c', colore || '#fff'); d.innerHTML = `${pensa ? '<span class="pt"><i></i><i></i><i></i></span>' : ''}<span class="tx">${esc(testo)}</span>`; } };
}
function siedi(om, posto, rot) { om.g.position.copy(posto); om.g.rotation.y = rot; om.stato = 'seduto'; om.tappe = []; }

function personaggiFissi() {
  for (const st of stanze.values()) {
    const om = new Omino({ coloreReparto: st.rep.colore, ruolo: 'capo-reparto' });
    scena.add(om.g); omini.add(om); siedi(om, st.capo.posto, st.capo.rotazione); om.inattivo = true;
    const b = bolla(om, 1.62);
    om.onClic = () => P.apriLavori({ titolo: 'Capo reparto', stato: '', nome: st.rep.capoReparto.nome, colore: st.rep.colore, sottotitolo: esc(st.rep.nome), filtro: (s) => s.capoRep && s.info.reparto === st.rep.id });
    capiReparto.set(st.rep.id, { om, bolla: b, schermo: null });
  }
  capoOm = new Omino({ ruolo: 'capo' }); scena.add(capoOm.g); omini.add(capoOm); siedi(capoOm, capo.posto, 0); capoOm.g.scale.setScalar(1.12);
  capoOm.bolla = bolla(capoOm, 1.7); capoOm.bolla.dici('In attesa di richieste', '#ffcf73', false);
}

function percorsoArrivo(st, posto, asc, tor) {
  const zc = corridoioDi(st.riga), porta = st.cx - 4.75;
  return [
    { p: new THREE.Vector3(asc.x, 0, Z1 - 4.6) },
    { p: new THREE.Vector3(tor.x, 0, 22.9) }, { p: new THREE.Vector3(tor.x, 0, 22.35), arrivo: 'timbra' }, { pausa: 0.9 },
    { p: new THREE.Vector3(tor.x, 0, 20.2) }, { p: new THREE.Vector3(0, 0, 19.6) }, { p: new THREE.Vector3(0, 0, zc) },
    { p: new THREE.Vector3(porta, 0, zc) }, { p: new THREE.Vector3(porta, 0, st.cz + D / 2 - 0.4) },
    ...posto.via.map((p) => ({ p })), { p: posto.posto.clone().setY(0) },
  ];
}

function muovi(om, dt) {
  if (!om.tappe?.length) return;
  const tp = om.tappe[0];
  if (tp.pausa !== undefined) { tp.pausa -= dt; if (tp.pausa <= 0) om.tappe.shift(); om.stato = 'fermo'; return; }
  const d = new THREE.Vector3().subVectors(tp.p, om.g.position); d.y = 0;
  const L = d.length();
  if (L < 0.05) {
    om.g.position.x = tp.p.x; om.g.position.z = tp.p.z; om.tappe.shift();
    if (tp.arrivo === 'timbra') timbratura(om, false); else if (tp.arrivo === 'esce') timbratura(om, true); else if (typeof tp.arrivo === 'function') tp.arrivo();
    if (!om.tappe.length) { om.stato = 'fermo'; const f = om.poi; om.poi = null; f?.(); }
    return;
  }
  om.stato = 'cammina';
  om.g.position.addScaledVector(d.normalize(), Math.min(L, 3.4 * dt));
  om.g.position.y += (0 - om.g.position.y) * Math.min(1, dt * 10);
  const ang = Math.atan2(d.x, d.z);
  om.g.rotation.y += (((ang - om.g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 10);
}

function timbratura(om, uscita) {
  const tor = tornelli.reduce((a, b) => (Math.abs(b.x - om.g.position.x) < Math.abs(a.x - om.g.position.x) ? b : a));
  tor.timbra = 1.4; tor.colore = uscita ? '#f59e0b' : '#22c55e';
  om.timbra();
  const d = document.createElement('div'); d.className = `timbro${uscita ? ' uscita' : ''}`;
  d.textContent = `${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} ${uscita ? 'USCITA' : 'ENTRATA'} ✓`;
  const o = new CSS2DObject(d); o.position.y = 1.6; om.g.add(o); setTimeout(() => o.removeFromParent(), 1700);
}

function assumi(e, istantaneo) {
  const st = stanze.get(e.reparto);
  if (e.ruolo === 'capo-reparto') {
    const c = capiReparto.get(e.reparto); if (!c) return;
    c.om.modello(coloreModello(e.modello)); c.om.inattivo = false;
    c.bolla.dici(`Revisione · ${e.titolo}`, st.rep.colore);
    c.schermo = new Schermo(st.capo.schermi, 512, 320);
    impiegati.set(e.id, { om: c.om, stanza: st, info: e, righe: [], schermo: c.schermo, bolla: c.bolla, capoRep: true });
    return;
  }
  const stanza = st || [...stanze.values()][0];
  const posto = stanza.posti.find((p) => p.libero) || stanza.posti[(Math.random() * 4) | 0];
  posto.libero = false;
  const om = new Omino({ coloreReparto: stanza.rep.colore, coloreModello: coloreModello(e.modello) });
  scena.add(om.g); omini.add(om);
  const b = bolla(om);
  const imp = { om, stanza, posto, info: e, righe: [], schermo: new Schermo(posto.schermi, 512, 320), bolla: b };
  impiegati.set(e.id, imp);
  om.onClic = () => apriImpiegato(e.id);
  if (istantaneo) { siedi(om, posto.posto, posto.rotazione); b.dici(e.titolo, stanza.rep.colore); return; }
  const asc = ascensori[(Math.random() * 3) | 0], tor = tornelli[(Math.random() * 3) | 0];
  om.g.position.set(asc.x, 0, Z1 - 2.6); om.g.rotation.y = Math.PI;
  asc.apriFino = performance.now() + 3200;
  b.dici('Arrivo in ufficio…', stanza.rep.colore, false);
  om.tappe = percorsoArrivo(stanza, posto, asc, tor);
  om.poi = () => { siedi(om, posto.posto, posto.rotazione); if (!imp.statoTesto) b.dici(e.titolo, stanza.rep.colore); };
}

function congeda(e, istantaneo) {
  const imp = impiegati.get(e.id); if (!imp) return;
  impiegati.delete(e.id);
  if (imp.capoRep) {
    const fine = () => { imp.bolla.dici(''); imp.om.inattivo = true; imp.schermo.spegni(); capiReparto.get(imp.stanza.rep.id).schermo = null; };
    istantaneo ? fine() : setTimeout(fine, 2500); return;
  }
  const via = () => {
    imp.posto.libero = true; imp.schermo.spegni();
    if (istantaneo) { rimuovi(imp.om); return; }
    imp.bolla.dici('Fine turno', imp.stanza.rep.colore, false);
    const st = imp.stanza, zc = corridoioDi(st.riga), porta = st.cx - 4.75;
    const asc = ascensori[(Math.random() * 3) | 0], tor = tornelli[(Math.random() * 3) | 0];
    imp.om.tappe = [...imp.posto.via.slice().reverse().map((p) => ({ p })), { p: new THREE.Vector3(porta, 0, st.cz + D / 2 - 0.4) }, { p: new THREE.Vector3(porta, 0, zc) },
      { p: new THREE.Vector3(0, 0, zc) }, { p: new THREE.Vector3(0, 0, 19.6) }, { p: new THREE.Vector3(tor.x, 0, 20.4) }, { p: new THREE.Vector3(tor.x, 0, 20.9), arrivo: 'esce' }, { pausa: 0.8 },
      { p: new THREE.Vector3(tor.x, 0, 23.2) }, { p: new THREE.Vector3(asc.x, 0, Z1 - 4.6), arrivo: () => { asc.apriFino = performance.now() + 2600; } }, { p: new THREE.Vector3(asc.x, 0, Z1 - 2.4) }];
    imp.om.poi = () => setTimeout(() => rimuovi(imp.om), 600);
  };
  istantaneo ? via() : setTimeout(via, 2600);
}
function rimuovi(om) { om.g.traverse((o) => o.element?.remove()); om.g.removeFromParent(); omini.delete(om); }

// ===== Buste in volo =========================================================================================================
const buste = [];
const GEO_BUSTA = new THREE.BoxGeometry(0.36, 0.02, 0.24);
function puntoDi(nodo) {
  if (nodo === 'capo') return () => capoOm.g.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  if (nodo.startsWith('reparto:')) { const c = capiReparto.get(nodo.slice(8)); return c ? () => c.om.g.position.clone().add(new THREE.Vector3(0, 1.4, 0)) : null; }
  const imp = impiegati.get(nodo); return imp ? () => imp.om.g.position.clone().add(new THREE.Vector3(0, 1.4, 0)) : null;
}
function lanciaBusta(e) {
  const tappe = e.percorso.map(puntoDi).filter(Boolean); if (tappe.length < 2) return;
  const col = e.tipo === 'incarico' ? '#7dd3fc' : coloreAffidabilita(e.affidabilita);
  const g = new THREE.Group();
  const carta = new THREE.Mesh(GEO_BUSTA, new THREE.MeshStandardMaterial({ color: '#f8f5ee', roughness: 0.7 }));
  const sigillo = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8 }));
  sigillo.position.y = 0.015; carta.castShadow = true; g.add(carta, sigillo);
  g.traverse((o) => { o.userData.busta = e; });
  if (e.affidabilita != null) { const d = document.createElement('div'); d.className = 'perc'; d.style.setProperty('--m', col); d.textContent = `${Math.round(e.affidabilita * 100)}%`; const o = new CSS2DObject(d); o.position.y = 0.3; g.add(o); }
  scena.add(g); buste.push({ g, tappe, i: 0, t: 0, e });
}
function aggiornaBuste(dt) {
  for (let k = buste.length - 1; k >= 0; k--) {
    const b = buste[k], a = b.tappe[b.i](), c = b.tappe[b.i + 1](), L = a.distanceTo(c);
    b.t += dt / Math.max(1.2, L / 9);
    const q = Math.min(1, b.t), p = new THREE.Vector3().lerpVectors(a, c, q);
    p.y += Math.sin(Math.PI * q) * (2.2 + L * 0.12);
    b.g.position.copy(p); b.g.rotation.y += dt * 3; b.g.rotation.z = Math.sin(q * 12) * 0.2;
    if (q >= 1) { b.i++; b.t = 0; if (b.i >= b.tappe.length - 1) { b.g.traverse((o) => o.element?.remove()); b.g.removeFromParent(); buste.splice(k, 1); } }
  }
}

// ===== Eventi ===================================================================================================================
const conta = { buste: 0, pensieri: [], token: new Map(), risparmio: 0 };
const attivitaRep = new Map();
let P, azienda;
const nomeDi = (x) => {
  if (x === 'capo') return 'Il Capo';
  if (x.startsWith('reparto:')) return azienda.reparti.find((r) => r.id === x.slice(8))?.capoReparto.nome || x;
  const s = P?.registro.get(x); return s ? s.nome : x;
};
function rigaAttivita(imp, e) {
  const riga = { tipo: e.tipo, testo: (e.testo || (e.tipo === 'pensiero' ? 'ragiona…' : '')).replace(/\s+/g, ' '), icona: ICONE[e.tipo] || '·', colore: COLORI_RIGA[e.tipo] || '#e5e7eb', chi: imp.info.nome || imp.stanza.rep.capoReparto.nome };
  imp.righe.push(riga); if (imp.righe.length > 12) imp.righe.shift();
  const a = attivitaRep.get(imp.stanza.rep.id) || { righe: [] }; a.righe.push(riga); if (a.righe.length > 12) a.righe.shift(); attivitaRep.set(imp.stanza.rep.id, a);
}

function gestisci(e, istantaneo = false) {
  P.registra(e);
  switch (e.type) {
    case 'agente.assunto': assumi(e, istantaneo); break;
    case 'agente.stato': { const imp = impiegati.get(e.id); if (imp) { imp.statoTesto = e.testo; imp.bolla.dici(e.testo, imp.stanza.rep.colore); } break; }
    case 'agente.pensiero': {
      const imp = impiegati.get(e.id); if (!imp) break;
      rigaAttivita(imp, e);
      if (!istantaneo) {
        conta.pensieri.push(performance.now());
        if (e.tipo !== 'risultato') P.voce({ nome: imp.info.nome || imp.stanza.rep.capoReparto.nome, colore: imp.stanza.rep.colore, tipo: e.tipo, testo: e.testo, onclick: () => apriImpiegato(e.id) });
      }
      break;
    }
    case 'agente.token': conta.token.set(e.id, (e.input || 0) + (e.output || 0) + (e.cache || 0) + (e.cacheScritta || 0)); break;
    case 'agente.finito': conta.risparmio += Math.max(0, (e.tokenLavoro || 0) - (e.tokenBusta || 0)); break;
    case 'busta': {
      conta.buste++;
      if (e.tipo !== 'incarico') { const imp = impiegati.get(e.pid?.replace(/:out$/, '')); if (imp) attivitaRep.set(imp.stanza.rep.id, { ...(attivitaRep.get(imp.stanza.rep.id) || { righe: [] }), busta: { testo: e.sintesi || e.titolo, colore: coloreAffidabilita(e.affidabilita) } }); }
      if (!istantaneo) { lanciaBusta(e); P.ticker(e); }
      break;
    }
    case 'agente.uscito': congeda(e, istantaneo); break;
    case 'capo.richiesta': capoOm?.bolla.dici(e.testo, '#ffcf73'); if (!istantaneo) P.richiesta(e.testo); break;
    case 'capo.stato': capoOm?.bolla.dici(e.testo, '#ffcf73'); break;
    case 'vacancy': if (!istantaneo) P.posizione(e); break;
    case 'demo': statoDemo(e.attiva); break;
    default: break;
  }
}

function apriImpiegato(id) {
  const imp = impiegati.get(id), s = P.registro.get(id);
  if (!s) return;
  P.mostraDettaglio(() => { document.getElementById('dettaglio').innerHTML = `<h3 class="tit">Impiegato <span>${esc(s.stato)}</span></h3>${P.testaLavoro(s)}${P.htmlLavoro(s)}`; });
  if (imp) segui(imp.om);
}

// ===== Interfaccia ===========================================================================================================
const $ = (id) => document.getElementById(id);
function metriche() {
  const ora = performance.now(); conta.pensieri = conta.pensieri.filter((x) => ora - x < 60000);
  const tok = [...conta.token.values()].reduce((a, b) => a + b, 0);
  const presenti = [...impiegati.values()].filter((i) => !i.capoRep).length;
  P.metriche([['in ufficio', presenti], ['in revisione', impiegati.size - presenti], ['pensieri/min', conta.pensieri.length], ['buste', conta.buste], ['token lavoro', tok], ['fuori dal Capo', conta.risparmio]]);
  $('ritmo').textContent = `${conta.pensieri.length}/min`;
}
let demoOn = false;
function statoDemo(on) { demoOn = on; $('bDemo').textContent = on ? '■ Demo' : '▶ Demo'; $('bDemo').classList.toggle('on', on); }
$('bDemo').onclick = () => demo(!demoOn).then((r) => statoDemo(r.demo));

// ===== Camera: orbita, viste, inseguimento, passeggiata ========================================================================
const orbita = new OrbitControls(camera, renderer.domElement);
Object.assign(orbita, { enableDamping: true, dampingFactor: 0.06, maxPolarAngle: 1.38, minDistance: 2.5, maxDistance: 190, zoomToCursor: true });
orbita.target.set(0, 0, -4);
let viaggio = null, seguito = null;
const morbido = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function volaA(bersaglio, dist, alto = 0.75) {
  seguito = null;
  const dir = camera.position.clone().sub(orbita.target).setY(0).normalize();
  const a = bersaglio.clone().addScaledVector(dir, dist * 0.8).add(new THREE.Vector3(0, dist * alto, 0));
  viaggio = { da: camera.position.clone(), a, t0: orbita.target.clone(), t1: bersaglio.clone(), t: 0 };
}
function segui(om) { volaA(om.g.position.clone(), 6, 0.6); setTimeout(() => { seguito = om; }, 1700); }
orbita.addEventListener('start', () => { seguito = null; viaggio = null; });
const VISTE = {
  panoramica: [new THREE.Vector3(46, 44, 74), new THREE.Vector3(0, 0, -4)],
  hall: [new THREE.Vector3(7, 4.2, 19.7), new THREE.Vector3(0, 1.1, 29)],
  direzione: [new THREE.Vector3(9, 8, -22), new THREE.Vector3(0, 1, -36)],
};
for (const [k, [p, t]] of Object.entries(VISTE)) document.querySelector(`[data-vista="${k}"]`)?.addEventListener('click', () => { seguito = null; viaggio = { da: camera.position.clone(), a: p.clone(), t0: orbita.target.clone(), t1: t.clone(), t: 0 }; });

const passeggiata = new PointerLockControls(camera, document.body);
const tasti = new Set(); let modo = 'orbita';
addEventListener('keydown', (e) => { tasti.add(e.code); if (e.code === 'KeyF' && !e.repeat) modo === 'cammina' ? passeggiata.unlock() : entraPasseggiata(); });
addEventListener('keyup', (e) => tasti.delete(e.code));
function entraPasseggiata() { camera.position.set(orbita.target.x, 1.25, orbita.target.z + 4); passeggiata.lock(); }
passeggiata.addEventListener('lock', () => { modo = 'cammina'; orbita.enabled = false; $('bCammina').classList.add('on'); });
passeggiata.addEventListener('unlock', () => { modo = 'orbita'; orbita.enabled = true; camera.position.y = Math.max(camera.position.y, 6); orbita.update(); $('bCammina').classList.remove('on'); });
$('bCammina').onclick = entraPasseggiata;
function cammina(dt) {
  const v = tasti.has('ShiftLeft') ? 9 : 3.5, av = new THREE.Vector3(); camera.getWorldDirection(av); av.y = 0; av.normalize();
  const dx = new THREE.Vector3().crossVectors(av, camera.up);
  const x = (tasti.has('KeyD') || tasti.has('ArrowRight')) - (tasti.has('KeyA') || tasti.has('ArrowLeft'));
  const z = (tasti.has('KeyW') || tasti.has('ArrowUp')) - (tasti.has('KeyS') || tasti.has('ArrowDown'));
  camera.position.addScaledVector(av, z * v * dt).addScaledVector(dx, x * v * dt); camera.position.y = 1.25;
}

const raggio = new THREE.Raycaster(), ptr = new THREE.Vector2(); let premuto = null;
renderer.domElement.addEventListener('pointerdown', (e) => { premuto = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (modo !== 'orbita' || !premuto || Math.hypot(e.clientX - premuto.x, e.clientY - premuto.y) > 5) return;
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); raggio.setFromCamera(ptr, camera);
  const h = raggio.intersectObjects([...buste.map((b) => b.g), ...[...omini].map((o) => o.g)], true)[0];
  if (!h) return;
  if (h.object.userData.busta) P.apriBusta(h.object.userData.busta);
  else h.object.userData.omino?.onClic?.();
});

// ===== Ciclo ===================================================================================================================
const orologio = new THREE.Clock();
let fot = 0;
const tvs = new Map();
function ciclo() {
  requestAnimationFrame(ciclo);
  const dt = Math.min(orologio.getDelta(), 0.05), t = orologio.elapsedTime;
  if (modo === 'cammina') cammina(dt);
  else {
    if (viaggio) { viaggio.t = Math.min(1, viaggio.t + dt / 1.6); const k = morbido(viaggio.t); camera.position.lerpVectors(viaggio.da, viaggio.a, k); orbita.target.lerpVectors(viaggio.t0, viaggio.t1, k); if (viaggio.t >= 1) viaggio = null; }
    else if (seguito) { const p = seguito.g.position.clone().setY(0.8), d = p.sub(orbita.target).multiplyScalar(Math.min(1, dt * 3)); orbita.target.add(d); camera.position.add(d); }
    orbita.update();
  }
  for (const om of omini) { muovi(om, dt); om.aggiorna(dt, t); }
  aggiornaBuste(dt);
  const adesso = performance.now();
  for (const a of ascensori) {
    const ap = adesso < a.apriFino || [...omini].some((o) => Math.abs(o.g.position.x - a.x) < 1 && o.g.position.z > Z1 - 4.2) ? 1 : 0;
    a.apertura += (ap - a.apertura) * Math.min(1, dt * 3.5);
    for (const an of a.ante) an.position.x = an.userData.s * (0.31 + a.apertura * 0.55);
    a.spia.material.emissive.set(ap ? '#22c55e' : '#7dd3fc');
  }
  for (const tor of tornelli) {
    const vicino = [...omini].some((o) => Math.abs(o.g.position.x - tor.x) < 0.5 && Math.abs(o.g.position.z - 21.5) < 1.4);
    tor.aperto += ((vicino && tor.timbra < 0.6 ? 1 : 0) - tor.aperto) * Math.min(1, dt * 6);
    tor.ante.forEach((a, i) => { a.rotation.y = Math.PI / 2 + (i ? -1 : 1) * tor.aperto * 1.35; });
    tor.timbra = Math.max(0, tor.timbra - dt);
    tor.led.material.emissive.set(tor.timbra > 0 ? tor.colore : '#e5e7eb'); tor.led.material.emissiveIntensity = tor.timbra > 0 ? 3 : 0.8;
  }
  if (++fot % 6 === 0) {
    for (const imp of impiegati.values()) {
      const s = imp.schermo; if (!s) continue;
      disegnaSchermo(s.g, 512, 320, imp.stanza.rep.id, imp.stanza.rep.colore, t, { titolo: imp.info.titolo, modello: imp.info.modello, coloreModello: coloreModello(imp.info.modello), righe: imp.righe });
      s.tex.needsUpdate = true;
    }
  }
  if (fot % 30 === 0) { aggiornaLucine(); aggiornaTV(); for (const o of insegne) o.visible = camera.position.distanceTo(o.position) > 20; }
  composer.render();
  etichette.render(scena, camera);
}

function aggiornaTV() {
  for (const st of stanze.values()) {
    let s = tvs.get(st.rep.id); if (!s) { s = new Schermo([st.tv], 768, 432); tvs.set(st.rep.id, s); }
    const a = attivitaRep.get(st.rep.id) || { righe: [] };
    const attivi = [...impiegati.values()].filter((i) => i.stanza === st).length;
    disegnaTV(s.g, 768, 432, st.rep, { attivi, righe: a.righe, busta: a.busta }); s.tex.needsUpdate = true;
  }
  let sc = tvs.get('capo'); if (!sc) { sc = new Schermo([capo.tv], 1024, 576); tvs.set('capo', sc); }
  const g = sc.g; g.fillStyle = '#0a0f1c'; g.fillRect(0, 0, 1024, 576); g.fillStyle = '#ffcf73'; g.fillRect(0, 0, 1024, 8);
  g.fillStyle = '#fff'; g.font = '800 34px "Segoe UI"'; g.fillText('SALA COMANDO', 32, 60);
  const vivi = [...impiegati.values()];
  g.font = '600 20px Consolas'; g.fillStyle = vivi.length ? '#4ade80' : '#64748b'; g.fillText(`${vivi.length} connessioni attive`, 760, 58);
  vivi.slice(0, 11).forEach((imp, i) => {
    g.fillStyle = imp.stanza.rep.colore; g.fillRect(32, 92 + i * 42, 6, 30);
    g.fillStyle = '#e2e8f0'; g.font = '600 20px "Segoe UI"'; g.fillText(`${(imp.info.nome || imp.stanza.rep.capoReparto.nome).slice(0, 26)}`, 48, 114 + i * 42);
    g.fillStyle = coloreModello(imp.info.modello); g.font = '700 16px Consolas'; g.fillText(`${imp.info.modello}/${imp.info.effort}`.toUpperCase(), 360, 113 + i * 42);
    g.fillStyle = '#94a3b8'; g.font = '18px Consolas'; g.fillText((imp.statoTesto || imp.info.titolo).slice(0, 40), 540, 113 + i * 42);
  });
  sc.tex.needsUpdate = true;
}

// ===== Avvio =====================================================================================================================
azienda = (await caricaAzienda()).azienda;
costruisciEdificio(); hallEArredi(); lineaNord();
capo.tv.userData.dinamico = true; capo.schermoPC.userData.dinamico = true;
costruisciReparti(azienda);
console.info('[ufficio] geometria statica unita:', fondiStatici());
personaggiFissi();
P = creaPannelli({ azienda, nomeDi, vaiA: (s) => { const imp = impiegati.get(s.id); if (imp) segui(imp.om); else { const st = stanze.get(s.info.reparto); if (st) volaA(new THREE.Vector3(st.cx, 0, st.cz), 14); } } });
metriche(); setInterval(metriche, 500);
collegaStream({ replay: (d) => { statoDemo(d.demo); for (const e of d.eventi) gestisci(e, true); }, evento: (e) => gestisci(e) });
ciclo();
