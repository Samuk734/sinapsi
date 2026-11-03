// Sinapsi · rete neurale v2
// Capo = nucleo con galassia di particelle; reparti = gangli; impiegati = neuroni che si svegliano.
// Ogni pensiero, azione e risultato fa crescere un ramo di nodi; ogni file o fonte toccata
// diventa un nodo di memoria condiviso. Flussi di particelle calcolati interamente sulla GPU.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { caricaAzienda, collegaStream, demo, coloreModello, coloreAffidabilita, esc } from './comune.js';
import { creaPannelli } from './pannelli.js';

// ===== GLSL condiviso ===========================================================
const RUMORE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

// ===== Motore =====================================================================
const contenitore = document.getElementById('scena');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
contenitore.appendChild(renderer.domElement);
const etichette = new CSS2DRenderer();
etichette.setSize(innerWidth, innerHeight);
etichette.domElement.className = 'etichette';
contenitore.appendChild(etichette.domElement);

const scena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 6000);
camera.position.set(-60, 170, 420);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio(), { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scena, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.35, 0.42);
composer.addPass(bloom);
const lente = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTempo: { value: 0 }, uRis: { value: new THREE.Vector2(innerWidth, innerHeight) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTempo; uniform vec2 uRis; varying vec2 vUv;
    void main(){
      vec2 c = vUv - 0.5; float r = length(c);
      vec2 off = c * r * 0.0025;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= 1.0 - smoothstep(0.5, 1.0, r) * 0.55;
      float g = fract(sin(dot(vUv * uRis + uTempo * 61.7, vec2(12.9898, 78.233))) * 43758.5453);
      col += (g - 0.5) * 0.012;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(lente);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); etichette.setSize(innerWidth, innerHeight);
  lente.uniforms.uRis.value.set(innerWidth, innerHeight);
  flusso.mat.uniforms.uPx.value = galassia.material.uniforms.uPx.value = memoria.matPunti.uniforms.uPx.value = innerHeight * renderer.getPixelRatio();
});

function textura(fermate) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [o, a] of fermate) r.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const BAGLIORE = textura([[0, 1], [0.12, 0.85], [0.35, 0.22], [1, 0]]);
const ANELLO = textura([[0, 0], [0.6, 0], [0.76, 1], [0.84, 0.3], [1, 0]]);
const add = (o = {}) => ({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...o });
const PX = () => innerHeight * renderer.getPixelRatio();

// ===== Nebulosa di sfondo ===========================================================
const nebulosa = new THREE.Mesh(new THREE.SphereGeometry(3000, 64, 32), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, uniforms: { uTempo: { value: 0 } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: RUMORE + /* glsl */`
    uniform float uTempo; varying vec3 vDir;
    float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * snoise(p); p *= 2.03; a *= 0.5; } return s; }
    void main(){
      vec3 d = normalize(vDir);
      float n1 = fbm(d * 2.2 + vec3(0.0, uTempo * 0.004, 0.0));
      float n2 = fbm(d * 4.5 + vec3(7.1, 2.3, uTempo * 0.006));
      float banda = exp(-pow(d.y * 2.6 + n1 * 0.6, 2.0));
      vec3 col = vec3(0.004, 0.006, 0.02);
      col += vec3(0.10, 0.04, 0.24) * smoothstep(-0.1, 0.8, n1) * (0.4 + banda);
      col += vec3(0.02, 0.16, 0.22) * smoothstep(0.1, 0.9, n2) * banda;
      col += vec3(0.28, 0.06, 0.16) * pow(max(n1 * n2 * 2.0, 0.0), 2.0) * banda;
      float st = snoise(d * 520.0); float stelle = pow(max(st, 0.0), 22.0) * 6.0;
      float st2 = snoise(d * 190.0 + 3.0); stelle += pow(max(st2, 0.0), 30.0) * 9.0 * (0.6 + 0.4 * sin(uTempo * 2.0 + d.x * 90.0));
      col = col * 0.2 + vec3(0.85, 0.9, 1.0) * stelle * 0.45;
      gl_FragColor = vec4(col, 1.0);
    }`,
}));
scena.add(nebulosa);

// pulviscolo neurale vicino alla rete
const pulviscolo = (() => {
  const n = 9000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), v = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    v.randomDirection().multiplyScalar(20 + Math.pow(Math.random(), 0.5) * 460); v.y *= 0.55;
    pos.set([v.x, v.y, v.z], i * 3);
    c.setHSL(0.55 + Math.random() * 0.25, 0.7, 0.5 + Math.random() * 0.4); col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial(add({ size: 0.7, map: BAGLIORE, vertexColors: true, opacity: 0.22, sizeAttenuation: true })));
})();
scena.add(pulviscolo);

// ===== Attività per neurone e per sinapsi (lette dagli shader) ==============================
const MAXN = 96;
const attNeur = new Float32Array(MAXN);
const attCurva = new Float32Array(MAXN);

// ===== Somi con membrana viva ==============================================================
const SOMA_V = RUMORE + /* glsl */`
  uniform float uTempo, uAtt, uColpo, uSeme;
  varying vec3 vN, vVista; varying float vR;
  void main(){
    float n = snoise(position * 1.7 + uSeme + uTempo * (0.2 + uAtt * 0.6));
    float n2 = snoise(position * 4.0 - uTempo * 0.5 + uSeme);
    vR = n * 0.5 + 0.5;
    vec3 p = position * (1.0 + n * (0.08 + uAtt * 0.1) + n2 * 0.03 + uColpo * 0.22);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal); vVista = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const SOMA_F = /* glsl */`
  uniform vec3 uColore; uniform float uAtt, uColpo;
  varying vec3 vN, vVista; varying float vR;
  void main(){
    float fres = pow(1.0 - max(dot(vN, vVista), 0.0), 2.4);
    float vene = smoothstep(0.55, 0.95, vR);
    vec3 col = uColore * (0.05 + uAtt * 0.35) * (0.5 + vene);
    col += uColore * smoothstep(0.35, 0.9, fres) * (0.35 + uAtt * 1.3);
    col += mix(uColore, vec3(1.0), 0.5) * pow(vene, 4.0) * (0.15 + uAtt * 1.6);
    col += vec3(1.0) * smoothstep(0.5, 1.0, fres) * uColpo * 0.9;
    gl_FragColor = vec4(col, 1.0);
  }`;
const GEO_SOMA = new THREE.IcosahedronGeometry(1, 4);
const GEO_SOMA_HD = new THREE.IcosahedronGeometry(1, 5);

// ===== Dendriti (un'unica geometria, impulsi animati nello shader) =========================
const dendriti = {
  pos: [], prog: [], neur: [], col: [], linee: null,
  aggiungi(neurone, verso) {
    const c = neurone.colore, r = neurone.raggio, i = neurone.indice;
    const ramo = (o, d, L, lv, p0) => {
      const passi = 10; let p = o.clone(); const dir = d.clone();
      for (let k = 0; k < passi; k++) {
        dir.add(new THREE.Vector3().randomDirection().multiplyScalar(0.33)).normalize();
        const q = p.clone().addScaledVector(dir, L / passi);
        const a = p0 + (k / passi) * (1 - p0) * 0.9, b = p0 + ((k + 1) / passi) * (1 - p0) * 0.9;
        this.pos.push(p.x, p.y, p.z, q.x, q.y, q.z); this.prog.push(a, b); this.neur.push(i, i);
        this.col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        if (lv < 3 && k > 1 && Math.random() < 0.24) ramo(q, dir.clone(), L * 0.6, lv + 1, b);
        p = q;
      }
    };
    const rami = Math.round(7 + r * 2.2);
    for (let b = 0; b < rami; b++) {
      const d = new THREE.Vector3().randomDirection(); if (verso) d.addScaledVector(verso, 0.6).normalize();
      ramo(neurone.pos.clone().addScaledVector(d, r * 0.9), d, r * (3 + Math.random() * 4.5), 0, 0);
    }
  },
  costruisci() {
    if (this.linee) scena.remove(this.linee);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aProg', new THREE.Float32BufferAttribute(this.prog, 1));
    g.setAttribute('aNeur', new THREE.Float32BufferAttribute(this.neur, 1));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    this.linee = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      ...add(), uniforms: { uAtt: { value: attNeur }, uTempo: { value: 0 } },
      vertexShader: `attribute float aProg; attribute float aNeur; attribute vec3 color; uniform float uAtt[${MAXN}];
        varying float vP; varying float vA; varying vec3 vC; varying float vS;
        void main(){ vP = aProg; vA = uAtt[int(aNeur)]; vC = color; vS = aNeur * 0.731; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTempo; varying float vP; varying float vA; varying vec3 vC; varying float vS;
        void main(){
          float onda = pow(fract(vP * 2.2 - uTempo * (0.18 + vA * 0.9) + vS), 8.0);
          float a = (0.08 + vA * 0.4) * (1.0 - vP * 0.6) + onda * (0.06 + vA * 0.7);
          gl_FragColor = vec4(vC * a * 1.3, a);
        }`,
    }));
    this.linee.frustumCulled = false;
    scena.add(this.linee);
  },
};

// ===== Neuroni ==============================================================================
const neuroni = [];
class Neurone {
  constructor({ chiave, nome, tipo, colore, raggio, pos, verso, dati }) {
    Object.assign(this, { chiave, nome, tipo, raggio, dati });
    this.indice = neuroni.length; neuroni.push(this);
    this.pos = pos.clone(); this.verso = verso || pos.clone().normalize();
    this.colore = new THREE.Color(colore);
    this.istanze = new Map(); this.figliAttivi = 0; this.livello = 0; this.colpoV = 0; this.padre = null;
    this.gruppo = new THREE.Group(); this.gruppo.position.copy(pos);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColore: { value: this.colore }, uAtt: { value: 0 }, uColpo: { value: 0 }, uTempo: { value: 0 }, uSeme: { value: Math.random() * 40 } },
      vertexShader: SOMA_V, fragmentShader: SOMA_F,
    });
    this.soma = new THREE.Mesh(tipo === 'capo' ? GEO_SOMA_HD : GEO_SOMA, this.mat);
    this.soma.scale.setScalar(raggio); this.soma.userData.neurone = this;
    this.alone = new THREE.Sprite(new THREE.SpriteMaterial(add({ map: BAGLIORE, color: this.colore, opacity: 0.2 })));
    this.membrana = new THREE.Mesh(new THREE.IcosahedronGeometry(raggio * 1.7, 2), new THREE.MeshBasicMaterial(add({ color: this.colore, wireframe: true, opacity: 0.05 })));
    this.anello = new THREE.Mesh(new THREE.TorusGeometry(raggio * 2.4, Math.max(0.05, raggio * 0.035), 8, 96), new THREE.MeshBasicMaterial(add({ color: '#fff', opacity: 0 })));
    this.anello2 = this.anello.clone(); this.anello2.material = this.anello.material.clone(); this.anello2.scale.setScalar(1.25);
    this.gruppo.add(this.soma, this.alone, this.membrana, this.anello, this.anello2);
    this.div = document.createElement('div'); this.div.className = `et et-${tipo}`; this.div.style.setProperty('--c', colore);
    this.etichetta = new CSS2DObject(this.div); this.etichetta.position.set(0, raggio * 2.6 + 2, 0); this.gruppo.add(this.etichetta);
    dendriti.aggiungi(this, this.verso);
    this.disegna();
    scena.add(this.gruppo);
  }
  get obiettivo() {
    if (this.tipo === 'capo') return 0.7 + Math.min(0.3, istanze.size * 0.06);
    if (this.istanze.size) return 1;
    if (this.tipo === 'rep') return this.figliAttivi ? 0.7 : 0.32;
    return 0.06;
  }
  attiva(id, info) {
    this.istanze.set(id, { ...info, stato: 'si sveglia…', pensieri: [], token: null, nodi: [], inizio: performance.now() });
    const m = coloreModello(info.modello);
    this.anello.material.color.set(m); this.anello2.material.color.set(m);
    if (this.padre && this.istanze.size === 1) this.padre.figliAttivi++;
    this.colpo(1); onda(this.pos, this.colore, this.raggio * 10); scintille(this.pos, this.colore, 36);
    this.disegna();
  }
  disattiva(id) {
    if (!this.istanze.delete(id)) return;
    if (this.padre && this.istanze.size === 0) this.padre.figliAttivi--;
    this.disegna();
  }
  colpo(f = 1) { this.colpoV = Math.max(this.colpoV, f); }
  disegna() {
    const ist = [...this.istanze.values()].at(-1);
    this.div.classList.toggle('attivo', !!ist);
    if (this.tipo === 'capo') { this.div.innerHTML = '<b>IL CAPO</b>'; return; }
    if (!ist) { this.div.innerHTML = `<b>${esc(this.nome)}</b>`; return; }
    const m = coloreModello(ist.modello), x = this.istanze.size > 1 ? ` ×${this.istanze.size}` : '';
    this.div.innerHTML = `<span class="compito"><span class="chip" style="--m:${m}">${esc(ist.modello)} · ${esc(ist.effort)}${x}</span> ${esc(ist.ruolo === 'capo-reparto' ? 'Revisione · ' + ist.titolo : ist.titolo)}</span><span class="stato">${esc(ist.stato)}</span>`;
  }
  aggiorna(dt, t) {
    this.livello += (this.obiettivo - this.livello) * Math.min(1, dt * 2.2);
    this.colpoV *= Math.exp(-dt * 3);
    const L = this.livello + this.colpoV * 0.6;
    attNeur[this.indice] = L;
    const u = this.mat.uniforms; u.uAtt.value = L; u.uColpo.value = this.colpoV; u.uTempo.value = t;
    const k = this.tipo === 'capo' ? 0.35 : 1;
    this.alone.material.opacity = (0.02 + L * 0.14) * k;
    this.alone.scale.setScalar(this.raggio * (3 + L * 1.6) * k);
    this.membrana.rotation.y += dt * (0.05 + L * 0.5); this.membrana.rotation.z += dt * 0.03;
    this.membrana.material.opacity = 0.02 + L * 0.09;
    const on = this.istanze.size ? 0.9 : 0;
    for (const [a, s] of [[this.anello, 1], [this.anello2, -0.7]]) {
      a.material.opacity += (on * (s > 0 ? 1 : 0.5) - a.material.opacity) * Math.min(1, dt * 4);
      a.rotation.set(Math.PI / 2 + Math.sin(t * 0.6 + this.indice) * 0.5 * s, t * 0.9 * s, t * 1.4 * s);
    }
    this.soma.scale.setScalar(this.raggio * (1 + this.colpoV * 0.15));
  }
}

// ===== Sinapsi: curve + flusso GPU di particelle ==================================================
const sinapsi = new Map(); // 'padre|figlio' -> Sinapsi
const curve = [];
class Sinapsi {
  constructor(a, b, spessore, densita) {
    Object.assign(this, { a, b, spessore, densita });
    this.indice = curve.length; curve.push(this);
    this.colore = b.colore.clone();
    const d = a.pos.distanceTo(b.pos), perp = new THREE.Vector3().subVectors(b.pos, a.pos).cross(new THREE.Vector3(0, 1, 0)).normalize();
    const piega = () => perp.clone().multiplyScalar(d * (Math.random() - 0.5) * 0.45).add(new THREE.Vector3(0, (Math.random() - 0.5) * d * 0.35, 0));
    this.curva = new THREE.CubicBezierCurve3(a.pos.clone(), a.pos.clone().lerp(b.pos, 0.3).add(piega()), a.pos.clone().lerp(b.pos, 0.7).add(piega()), b.pos.clone());
    this.punti = this.curva.getSpacedPoints(200);
    this.lunghezza = this.curva.getLength();
    this.filo = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.punti), new THREE.LineBasicMaterial(add({ color: this.colore, opacity: 0.2 })));
    scena.add(this.filo);
    this.attivita = 0.1; this.lampo = 0;
  }
  punto(t, out) { const f = Math.min(0.99999, Math.max(0, t)) * 200, i = f | 0; return out.lerpVectors(this.punti[i], this.punti[i + 1], f - i); }
  aggiorna(dt) {
    this.attivita += (Math.max(this.b.livello, this.a.tipo === 'capo' ? 0 : this.b.livello) - this.attivita) * Math.min(1, dt * 2);
    this.lampo *= Math.exp(-dt * 1.6);
    attCurva[this.indice] = Math.min(1.25, this.attivita + this.lampo * 0.35);
    this.filo.material.opacity = 0.05 + this.attivita * 0.25 + this.lampo * 0.08;
  }
}

const flusso = {
  punti: null,
  mat: new THREE.ShaderMaterial({
    ...add(), uniforms: { uTempo: { value: 0 }, uAtt: { value: attCurva }, uPx: { value: 0 } },
    vertexShader: /* glsl */`
      attribute vec3 aP0, aP1, aP2, aP3, aCol; attribute float aOff, aVel, aCurva, aDim; attribute vec2 aRad;
      uniform float uTempo, uPx; uniform float uAtt[${MAXN}];
      varying vec3 vC; varying float vA;
      vec3 bez(float t){ float u = 1.0 - t; return u*u*u*aP0 + 3.0*u*u*t*aP1 + 3.0*u*t*t*aP2 + t*t*t*aP3; }
      vec3 bezD(float t){ float u = 1.0 - t; return 3.0*u*u*(aP1-aP0) + 6.0*u*t*(aP2-aP1) + 3.0*t*t*(aP3-aP2); }
      void main(){
        float att = uAtt[int(aCurva)];
        float t = fract(aOff + uTempo * aVel * (0.05 + att * 0.55));
        vec3 tg = normalize(bezD(t));
        vec3 n1 = normalize(cross(tg, vec3(0.0, 1.0, 0.0)) + 1e-4); vec3 n2 = cross(tg, n1);
        float sp = (0.6 + att * 1.2) * (0.35 + sin(3.14159 * t));
        vec3 p = bez(t) + (n1 * aRad.x + n2 * aRad.y) * sp;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min(aDim * uPx * (0.32 + att * 0.45) / -mv.z, 9.0);
        gl_Position = projectionMatrix * mv;
        vC = aCol; vA = (0.1 + att * 0.85) * smoothstep(0.0, 0.04, t) * smoothstep(1.0, 0.96, t) * smoothstep(3.0, 18.0, -mv.z);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vC; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.32, d) * 0.85 + smoothstep(0.5, 0.0, d) * 0.15; gl_FragColor = vec4(vC * a * vA * 1.25, a * vA); }`,
  }),
  costruisci() {
    if (this.punti) scena.remove(this.punti);
    let n = 0; for (const s of curve) n += s.densita;
    const A = (k) => new Float32Array(n * k);
    const p0 = A(3), p1 = A(3), p2 = A(3), p3 = A(3), col = A(3), off = A(1), vel = A(1), cur = A(1), dim = A(1), rad = A(2);
    let i = 0;
    for (const s of curve) {
      const [a, b, c, d] = [s.curva.v0, s.curva.v1, s.curva.v2, s.curva.v3];
      const colA = s.a.tipo === 'capo' ? new THREE.Color('#ffcf73') : s.a.colore;
      for (let k = 0; k < s.densita; k++, i++) {
        p0.set([a.x, a.y, a.z], i * 3); p1.set([b.x, b.y, b.z], i * 3); p2.set([c.x, c.y, c.z], i * 3); p3.set([d.x, d.y, d.z], i * 3);
        const cc = s.colore.clone().lerp(colA, Math.random() * 0.6).offsetHSL(0, 0, (Math.random() - 0.4) * 0.2);
        col.set([cc.r, cc.g, cc.b], i * 3);
        off[i] = Math.random(); vel[i] = (Math.random() < 0.7 ? 1 : -1) * (0.4 + Math.random() * 0.9) * (90 / s.lunghezza);
        cur[i] = s.indice; dim[i] = Math.random() < 0.04 ? 3.2 : 0.7 + Math.random() * 1.1;
        const ang = Math.random() * Math.PI * 2, rr = Math.pow(Math.random(), 1.6) * s.spessore;
        rad.set([Math.cos(ang) * rr, Math.sin(ang) * rr], i * 2);
      }
    }
    const g = new THREE.BufferGeometry();
    const at = (nome, arr, k) => g.setAttribute(nome, new THREE.BufferAttribute(arr, k));
    at('position', p0, 3); at('aP0', p0, 3); at('aP1', p1, 3); at('aP2', p2, 3); at('aP3', p3, 3); at('aCol', col, 3);
    at('aOff', off, 1); at('aVel', vel, 1); at('aCurva', cur, 1); at('aDim', dim, 1); at('aRad', rad, 2);
    this.punti = new THREE.Points(g, this.mat); this.punti.frustumCulled = false;
    scena.add(this.punti);
  },
};

// ===== Galassia del Capo ==============================================================================
const galassia = (() => {
  const n = 26000, rad = new Float32Array(n), ang = new Float32Array(n), alt = new Float32Array(n), col = new Float32Array(n * 3), dim = new Float32Array(n);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const r = 11 + Math.pow(Math.random(), 1.8) * 52, braccio = (i % 4) * Math.PI / 2;
    rad[i] = r; ang[i] = braccio + r * 0.11 + (Math.random() - 0.5) * (0.5 + 30 / r);
    alt[i] = (Math.random() - 0.5) * (6 - r * 0.06) * Math.random();
    const k = (r - 11) / 52;
    c.setHSL(0.11 - k * 0.2 + (Math.random() - 0.5) * 0.05, 0.85, 0.62 - k * 0.2); col.set([c.r, c.g, c.b], i * 3);
    dim[i] = Math.random() < 0.02 ? 3.5 : 0.6 + Math.random() * 1.1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aRad', new THREE.BufferAttribute(rad, 1)); g.setAttribute('aAng', new THREE.BufferAttribute(ang, 1));
  g.setAttribute('aAlt', new THREE.BufferAttribute(alt, 1)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aDim', new THREE.BufferAttribute(dim, 1));
  const p = new THREE.Points(g, new THREE.ShaderMaterial({
    ...add(), uniforms: { uTempo: { value: 0 }, uPx: { value: 0 }, uAtt: { value: 0.7 } },
    vertexShader: /* glsl */`attribute float aRad, aAng, aAlt, aDim; attribute vec3 aCol; uniform float uTempo, uPx, uAtt; varying vec3 vC; varying float vA;
      void main(){ float a = aAng + uTempo * (2.2 / sqrt(aRad)) * (0.3 + uAtt * 0.4);
        vec3 p = vec3(cos(a) * aRad, aAlt, sin(a) * aRad); vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min(aDim * uPx * 0.45 / -mv.z, 7.0); gl_Position = projectionMatrix * mv; vC = aCol; vA = (0.16 + uAtt * 0.22) * smoothstep(4.0, 30.0, -mv.z); }`,
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.3, d); gl_FragColor = vec4(vC * a * vA * 1.3, a * vA); }',
  }));
  p.rotation.set(0.32, 0, 0.12); p.frustumCulled = false;
  return p;
})();
scena.add(galassia);
const giroscopi = [[16, 0.08], [21, 0.06], [27, 0.05]].map(([r, s], i) => {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, s, 8, 200), new THREE.MeshBasicMaterial(add({ color: i === 1 ? '#7dd3fc' : '#ffcf73', opacity: 0.4 })));
  m.userData.v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.4);
  scena.add(m); return m;
});

// ===== Memoria: nodi di pensiero e di conoscenza (GPU) =======================================================
const TIPI = {
  pensiero: { colore: '#b794ff', dim: 3.0, nome: 'pensiero' },
  testo: { colore: '#e8eeff', dim: 2.6, nome: 'riflessione' },
  strumento: { colore: '#38e1ff', dim: 2.4, nome: 'azione' },
  risultato: { colore: '#9aa8c8', dim: 1.8, nome: 'risultato' },
  file: { colore: '#ffb347', dim: 3.2, nome: 'file' },
  web: { colore: '#5eead4', dim: 3.2, nome: 'fonte web' },
  ricerca: { colore: '#a3e635', dim: 2.8, nome: 'ricerca' },
  comando: { colore: '#f472b6', dim: 2.8, nome: 'comando' },
  competenza: { colore: '#8ea3ff', dim: 1.5, nome: 'competenza' },
};
const memoria = {
  CAP: 12000, LCAP: 30000, n: 0, ln: 0, nodi: [],
  init() {
    const g = new THREE.BufferGeometry(), C = this.CAP;
    this.aPos = new THREE.BufferAttribute(new Float32Array(C * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(C * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aDim = new THREE.BufferAttribute(new Float32Array(C), 1).setUsage(THREE.DynamicDrawUsage);
    this.aNasc = new THREE.BufferAttribute(new Float32Array(C), 1).setUsage(THREE.DynamicDrawUsage);
    this.aLuce = new THREE.BufferAttribute(new Float32Array(C), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('aCol', this.aCol); g.setAttribute('aDim', this.aDim); g.setAttribute('aNasc', this.aNasc); g.setAttribute('aLuce', this.aLuce);
    g.setDrawRange(0, 0);
    this.matPunti = new THREE.ShaderMaterial({
      ...add(), uniforms: { uTempo: { value: 0 }, uPx: { value: 0 } },
      vertexShader: /* glsl */`attribute vec3 aCol; attribute float aDim, aNasc, aLuce; uniform float uTempo, uPx; varying vec3 vC; varying float vA;
        void main(){ float eta = uTempo - aNasc; float pop = smoothstep(0.0, 0.35, eta) * (1.0 + 2.2 * exp(-eta * 3.0));
          float tw = 0.75 + 0.25 * sin(uTempo * 3.0 + aNasc * 17.0);
          vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(aDim * pop * uPx * (0.5 + aLuce * 0.5) / -mv.z, 26.0);
          gl_Position = projectionMatrix * mv; vC = aCol; vA = (0.25 + aLuce * 0.9) * tw * smoothstep(1.5, 8.0, -mv.z); }`,
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float disco = smoothstep(0.30, 0.24, d); float anello = smoothstep(0.5, 0.44, d) * smoothstep(0.36, 0.42, d); float nucleo = smoothstep(0.12, 0.05, d); vec3 col = vC * (disco * 0.9 + anello * 1.2) + vec3(nucleo) * 0.8; float a = max(disco, anello); gl_FragColor = vec4(col * vA, a * vA); }',
    });
    this.punti = new THREE.Points(g, this.matPunti); this.punti.frustumCulled = false; scena.add(this.punti);

    const lg = new THREE.BufferGeometry(), L = this.LCAP * 2;
    this.lPos = new THREE.BufferAttribute(new Float32Array(L * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.lCol = new THREE.BufferAttribute(new Float32Array(L * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.lNasc = new THREE.BufferAttribute(new Float32Array(L), 1).setUsage(THREE.DynamicDrawUsage);
    this.lProg = new THREE.BufferAttribute(new Float32Array(L), 1).setUsage(THREE.DynamicDrawUsage);
    lg.setAttribute('position', this.lPos); lg.setAttribute('aCol', this.lCol); lg.setAttribute('aNasc', this.lNasc); lg.setAttribute('aProg', this.lProg);
    lg.setDrawRange(0, 0);
    this.linee = new THREE.LineSegments(lg, new THREE.ShaderMaterial({
      ...add(), uniforms: { uTempo: { value: 0 } },
      vertexShader: 'attribute vec3 aCol; attribute float aNasc, aProg; uniform float uTempo; varying vec3 vC; varying float vA; varying float vP; varying float vN; void main(){ vC = aCol; vP = aProg; vN = aNasc; vA = smoothstep(aProg * 0.5, aProg * 0.5 + 0.4, uTempo - aNasc); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uTempo; varying vec3 vC; varying float vA; varying float vP; varying float vN; void main(){ float onda = pow(fract(vP - uTempo * 0.6 + vN), 10.0); float a = vA * (0.14 + onda * 0.6); gl_FragColor = vec4(vC * a * 1.2, a); }',
    }));
    this.linee.frustumCulled = false; scena.add(this.linee);
  },
  nodo(pos, tipo, info, t, luce = 1) {
    if (this.n >= this.CAP) return null;
    const i = this.n++, c = new THREE.Color(info.colore || TIPI[tipo].colore);
    this.aPos.setXYZ(i, pos.x, pos.y, pos.z); this.aCol.setXYZ(i, c.r, c.g, c.b);
    this.aDim.setX(i, (info.dim || TIPI[tipo].dim)); this.aNasc.setX(i, t); this.aLuce.setX(i, luce);
    for (const a of [this.aPos, this.aCol, this.aDim, this.aNasc, this.aLuce]) { if (!this.blocco) a.addUpdateRange(i * a.itemSize, a.itemSize); a.needsUpdate = true; }
    this.punti.geometry.setDrawRange(0, this.n);
    const rec = { i, pos: pos.clone(), tipo, ...info };
    this.nodi.push(rec);
    return rec;
  },
  luce(rec, v) { this.aLuce.setX(rec.i, v); if (!this.blocco) this.aLuce.addUpdateRange(rec.i, 1); this.aLuce.needsUpdate = true; },
  // durante il replay si caricano migliaia di nodi: un solo caricamento completo alla fine
  fineBlocco() {
    this.blocco = false;
    for (const a of [this.aPos, this.aCol, this.aDim, this.aNasc, this.aLuce, this.lPos, this.lCol, this.lNasc, this.lProg]) { a.clearUpdateRanges(); a.needsUpdate = true; }
  },
  legame(a, b, colore, t, curvo = 0) {
    const c = new THREE.Color(colore), passi = curvo ? 12 : 1;
    const pts = [];
    if (curvo) { const m = a.clone().lerp(b, 0.5).multiplyScalar(1 + curvo); const q = new THREE.QuadraticBezierCurve3(a, m, b); pts.push(...q.getPoints(passi)); } else pts.push(a, b);
    for (let k = 0; k < pts.length - 1; k++) {
      if (this.ln >= this.LCAP) return;
      const j = this.ln++ * 2;
      this.lPos.setXYZ(j, pts[k].x, pts[k].y, pts[k].z); this.lPos.setXYZ(j + 1, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
      this.lCol.setXYZ(j, c.r, c.g, c.b); this.lCol.setXYZ(j + 1, c.r, c.g, c.b);
      this.lNasc.setX(j, t); this.lNasc.setX(j + 1, t); this.lProg.setX(j, k / passi); this.lProg.setX(j + 1, (k + 1) / passi);
      if (!this.blocco) {
        for (const at of [this.lPos, this.lCol]) at.addUpdateRange(j * 3, 6);
        for (const at of [this.lNasc, this.lProg]) at.addUpdateRange(j, 2);
      }
    }
    for (const at of [this.lPos, this.lCol, this.lNasc, this.lProg]) at.needsUpdate = true;
    this.linee.geometry.setDrawRange(0, this.ln * 2);
  },
};
memoria.init();

// ===== Effetti: onde, scintille, impulsi ================================================================
const onde = [];
function onda(pos, colore, dim) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial(add({ map: ANELLO, color: colore, opacity: 0.45 })));
  s.position.copy(pos); scena.add(s); onde.push({ s, t: 0, dim });
}
const sciami = [];
function scintille(pos, colore, n) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), v = [];
  for (let i = 0; i < n; i++) { p.set([pos.x, pos.y, pos.z], i * 3); v.push(new THREE.Vector3().randomDirection().multiplyScalar(8 + Math.random() * 30)); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const pt = new THREE.Points(g, new THREE.PointsMaterial(add({ map: BAGLIORE, color: colore, size: 0.9, sizeAttenuation: true, opacity: 0.7 })));
  pt.frustumCulled = false; scena.add(pt); sciami.push({ pt, v, t: 0 });
}

const impulsi = [];
class Impulso {
  constructor(ev, segmenti, colore) {
    Object.assign(this, { ev, segmenti }); this.colore = new THREE.Color(colore);
    this.seg = 0; this.t = 0; this.pos = new THREE.Vector3(); this.fine = 0; this.nuovo = true;
    const big = ev.tipo === 'incarico' ? 4.5 : 6.5;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial(add({ map: BAGLIORE, color: this.colore, opacity: 0.8 }))); this.sprite.scale.setScalar(big); this.sprite.userData.impulso = this;
    this.nucleo = new THREE.Sprite(new THREE.SpriteMaterial(add({ map: BAGLIORE, color: '#ffffff' }))); this.nucleo.scale.setScalar(big * 0.32);
    this.scia = Array.from({ length: 60 }, () => new THREE.Vector3());
    this.fulmineOn = false;
    const g = new THREE.BufferGeometry().setFromPoints(this.scia), c = new Float32Array(180);
    for (let i = 0; i < 60; i++) { const k = Math.pow(1 - i / 60, 2.2) * 0.75; c.set([this.colore.r * k, this.colore.g * k, this.colore.b * k], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.linea = new THREE.Line(g, new THREE.LineBasicMaterial(add({ vertexColors: true })));
    this.fulmine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 10 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial(add({ color: this.colore.clone().lerp(new THREE.Color('#fff'), 0.5) })));
    for (const o of [this.linea, this.fulmine]) o.frustumCulled = false;
    scena.add(this.sprite, this.nucleo, this.linea, this.fulmine);
  }
  aggiorna(dt) {
    if (this.fine) { this.fine += dt; this.linea.material.opacity = Math.max(0, 1 - this.fine * 2); this.fulmine.visible = false; return this.fine < 0.5; }
    const s = this.segmenti[this.seg];
    s.sinapsi.lampo = Math.max(s.sinapsi.lampo, 0.6);
    this.t += dt * (this.ev.tipo === 'incarico' ? 85 : 62) / s.sinapsi.lunghezza;
    if (this.t >= 1) {
      const arrivo = s.inverso ? s.sinapsi.a : s.sinapsi.b;
      arrivo.colpo(0.7); onda(arrivo.pos, this.colore, arrivo.raggio * 7); scintille(arrivo.pos, this.colore, 24);
      this.seg++; this.t = 0;
      if (this.seg >= this.segmenti.length) { this.fine = 1e-4; scena.remove(this.sprite, this.nucleo); return true; }
    }
    const S = this.segmenti[this.seg];
    S.sinapsi.punto(S.inverso ? 1 - this.t : this.t, this.pos);
    if (this.nuovo) { this.scia.forEach((v) => v.copy(this.pos)); this.nuovo = false; }
    this.scia.pop(); this.scia.unshift(this.pos.clone());
    this.linea.geometry.setFromPoints(this.scia);
    const f = this.fulmine.geometry.attributes.position, avanti = new THREE.Vector3();
    S.sinapsi.punto(S.inverso ? 1 - this.t - 0.06 : this.t + 0.06, avanti);
    for (let k = 0; k < 10; k++) {
      const q = this.pos.clone().lerp(avanti, k / 9);
      if (k > 0 && k < 9) q.add(new THREE.Vector3().randomDirection().multiplyScalar(1.6));
      f.setXYZ(k, q.x, q.y, q.z);
    }
    f.needsUpdate = true; this.fulmine.visible = false;
    this.sprite.position.copy(this.pos); this.nucleo.position.copy(this.pos);
    this.sprite.scale.setScalar((this.ev.tipo === 'incarico' ? 4.5 : 6.5) * (1 + Math.sin(performance.now() * 0.02) * 0.08));
    return true;
  }
  distruggi() { scena.remove(this.sprite, this.nucleo, this.linea, this.fulmine); }
}

// ===== Costruzione della rete =================================================================================
const nodi = new Map(), istanze = new Map();
let azienda;

function collega(padre, figlio, spessore, densita) {
  figlio.padre = padre;
  const s = new Sinapsi(padre, figlio, spessore, densita);
  sinapsi.set(`${padre.chiave}|${figlio.chiave}`, s);
  return s;
}

function costruisciRete() {
  const capo = new Neurone({ chiave: 'capo', nome: 'Il Capo', tipo: 'capo', colore: '#ffcf73', raggio: 8, pos: new THREE.Vector3() });
  nodi.set('capo', capo);
  const aree = azienda.aree;
  aree.forEach((area, ai) => {
    const reps = azienda.reparti.filter((r) => r.area === area.id);
    const base = (ai / aree.length) * Math.PI * 2 + 0.3, quota = Math.sin(ai * 2.1) * 55;
    const ea = document.createElement('div'); ea.className = 'et-area'; ea.textContent = area.nome.replace('Area ', '');
    const o = new CSS2DObject(ea); o.position.set(Math.cos(base) * 300, quota + 70, Math.sin(base) * 300); scena.add(o);
    reps.forEach((rep, j) => {
      const ang = base + (j - (reps.length - 1) / 2) * 0.27, rad = 150 + (j % 2) * 36;
      const pos = new THREE.Vector3(Math.cos(ang) * rad, quota + (j % 2 ? 22 : -20) + (Math.random() - 0.5) * 12, Math.sin(ang) * rad);
      const fuori = pos.clone().normalize();
      const cr = new Neurone({ chiave: `reparto:${rep.id}`, nome: rep.nome, tipo: 'rep', colore: rep.colore, raggio: 3.4, pos, verso: fuori, dati: rep });
      nodi.set(cr.chiave, cr);
      collega(capo, cr, 2.6, 1700);
      rep.impiegati.forEach((imp, k) => {
        const n = rep.impiegati.length, y = n === 1 ? 0.2 : 1 - (k / (n - 1)) * 2, phi = k * 2.4 + j;
        const dir = new THREE.Vector3(Math.cos(phi) * Math.sqrt(1 - y * y), y * 0.9, Math.sin(phi) * Math.sqrt(1 - y * y)).addScaledVector(fuori, 1.25).normalize();
        const pe = pos.clone().addScaledVector(dir, 30 + Math.random() * 6);
        const ne = new Neurone({ chiave: `imp:${imp.agente}`, nome: imp.nome, tipo: 'imp', colore: rep.colore, raggio: 1.8, pos: pe, verso: dir, dati: { ...imp, reparto: rep } });
        nodi.set(ne.chiave, ne);
        collega(cr, ne, 1.0, 520);
        // satelliti di competenza: le parole chiave della mansione
        const parole = imp.mansione.replace(/\.$/, '').split(/[,:]| e /).map((x) => x.trim()).filter((x) => x.length > 2).slice(0, 6);
        parole.forEach((p, q) => {
          const d2 = dir.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(0.9)).normalize();
          const pp = pe.clone().addScaledVector(d2, 7 + q * 1.3 + Math.random() * 3);
          const rec = memoria.nodo(pp, 'competenza', { testo: p, colore: rep.colore, dim: 1.6, agente: imp.nome }, -10, 0.3);
          if (rec) memoria.legame(pe, pp, rep.colore, -10);
        });
      });
    });
  });
  dendriti.costruisci(); flusso.costruisci();
}

function neuroneEsterno(e) {
  const dir = new THREE.Vector3().randomDirection(); dir.y *= 0.4; dir.normalize();
  const n = new Neurone({ chiave: `ext:${e.id}`, nome: e.agente, tipo: 'imp', colore: '#cbd5e1', raggio: 1.6, pos: dir.clone().multiplyScalar(70), verso: dir, dati: { agente: e.agente, mansione: 'Agente esterno a Sinapsi' } });
  nodi.set(n.chiave, n); collega(nodi.get('capo'), n, 0.8, 300);
  dendriti.costruisci(); flusso.costruisci();
  return n;
}

const chiaveNodo = (x) => (x === 'capo' || x.startsWith('reparto:') ? x : istanze.get(x)?.chiave);
function segmentiPercorso(percorso) {
  const ch = percorso.map(chiaveNodo).filter(Boolean);
  const su = (k) => { const o = [k]; let n = nodi.get(k); while (n?.padre) { n = n.padre; o.push(n.chiave); } return o; };
  const tappe = [ch[0]];
  for (let i = 1; i < ch.length; i++) {
    const A = su(ch[i - 1]), B = su(ch[i]), c = A.find((x) => B.includes(x));
    tappe.push(...A.slice(1, A.indexOf(c) + 1), ...B.slice(0, B.indexOf(c)).reverse());
  }
  const out = [];
  for (let i = 1; i < tappe.length; i++) {
    const g = sinapsi.get(`${tappe[i - 1]}|${tappe[i]}`), s = sinapsi.get(`${tappe[i]}|${tappe[i - 1]}`);
    if (g) out.push({ sinapsi: g, inverso: false }); else if (s) out.push({ sinapsi: s, inverso: true });
  }
  return out;
}

// ===== Albero dei pensieri e memoria condivisa ==========================================================
const sapere = new Map(); // chiave -> nodo di conoscenza
// il dettaglio arriva come JSON troncato: si estraggono i campi con espressioni regolari
function chiaveSapere(dettaglio = '') {
  const campo = (k) => new RegExp(`"${k}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`).exec(dettaglio)?.[1];
  const f = campo('file_path'), u = campo('url'), q = campo('query'), p = campo('pattern'), c = campo('command'), d = campo('description');
  if (f) return ['file', f.split(/[\\/]+/).pop()];
  if (u) { try { return ['web', new URL(u).host]; } catch { return ['web', u.slice(0, 40)]; } }
  if (q) return ['ricerca', q.slice(0, 40)];
  if (p) return ['ricerca', `grep ${p}`.slice(0, 40)];
  if (c) return ['comando', (d || c).slice(0, 40)];
  return null;
}

function cresci(n, ist, e, t, istantaneo) {
  const tipo = TIPI[e.tipo] ? e.tipo : 'testo';
  const padre = tipo === 'risultato' ? (ist.ultStrum || ist.ult) : tipo === 'strumento' ? (ist.ultPens || ist.ult) : ist.ult;
  const da = padre ? padre.pos : n.pos;
  const dir = (padre?.dir || n.verso).clone().add(new THREE.Vector3().randomDirection().multiplyScalar(tipo === 'strumento' ? 0.75 : 0.5)).normalize();
  const passo = tipo === 'pensiero' ? 8 : tipo === 'testo' ? 7 : tipo === 'strumento' ? 6 : 4.5;
  const pos = da.clone().addScaledVector(dir, passo + Math.random() * 3);
  const testo = e.testo || (tipo === 'pensiero' ? 'ragiona in silenzio…' : '');
  const rec = memoria.nodo(pos, tipo, { testo, agente: n.nome, colore: tipo === 'pensiero' ? n.colore.clone().lerp(new THREE.Color(TIPI.pensiero.colore), 0.55) : undefined, ts: e.ts, modello: ist.modello }, t, istantaneo ? 0.35 : 1);
  if (!rec) return;
  rec.dir = dir; rec.neurone = n; rec.idIstanza = e.id;
  const voceReg = P.registro.get(e.id)?.passi.at(-1); if (voceReg) voceReg.nodo = rec;
  memoria.legame(da, pos, TIPI[tipo].colore, t);
  ist.nodi.push(rec); ist.ult = rec;
  if (tipo === 'pensiero' || tipo === 'testo') ist.ultPens = rec;
  if (tipo === 'strumento') {
    ist.ultStrum = rec;
    const k = chiaveSapere(e.dettaglio);
    if (k) {
      const [genere, nome] = k, chiave = `${genere}:${nome}`;
      let s = sapere.get(chiave);
      if (!s) {
        const d = n.pos.clone().normalize().add(new THREE.Vector3().randomDirection().multiplyScalar(0.35)).normalize();
        const p = d.multiplyScalar(270 + Math.random() * 70); p.y = p.y * 0.6 + (Math.random() - 0.5) * 60;
        s = memoria.nodo(p, genere, { testo: nome, genere, usi: 0 }, t, 0.9);
        if (s) { sapere.set(chiave, s); if (!istantaneo) etichettaSapere(s); }
      }
      if (s) { s.usi++; memoria.legame(pos, s.pos, TIPI[genere].colore, t, 0.08); }
    }
  }
  if (!istantaneo) {
    carta(rec, tipo);
    voceCoscienza(rec, n);
  }
  conta.nodi = memoria.n;
}

// carte olografiche temporanee vicino al nodo appena nato
const carte = [];
function carta(rec, tipo) {
  const d = document.createElement('div'); d.className = `carta ${tipo}`;
  d.style.setProperty('--c', `#${new THREE.Color(TIPI[tipo].colore).getHexString()}`);
  d.innerHTML = `<i>${TIPI[tipo].nome} · ${esc(rec.agente)}</i>${esc((rec.testo || '').slice(0, 150))}`;
  const o = new CSS2DObject(d); o.position.copy(rec.pos); scena.add(o);
  carte.push({ o, t: performance.now() });
  while (carte.length > 10) { const c = carte.shift(); scena.remove(c.o); }
}
function etichettaSapere(s) {
  const d = document.createElement('div'); d.className = 'sapere';
  d.style.setProperty('--c', TIPI[s.genere].colore); d.textContent = s.testo;
  const o = new CSS2DObject(d); o.position.copy(s.pos).add(new THREE.Vector3(0, 3, 0)); scena.add(o); s.etichetta = o;
}

// etichette ravvicinate: un piccolo gruppo riutilizzato per i nodi vicini alla camera
const pool = Array.from({ length: 36 }, () => { const d = document.createElement('div'); d.className = 'mini'; const o = new CSS2DObject(d); o.visible = false; scena.add(o); return o; });
function aggiornaPool() {
  const cam = camera.position, vicini = [];
  for (const r of memoria.nodi) { if (r.tipo === 'file' || r.tipo === 'web' || r.tipo === 'ricerca' || r.tipo === 'comando') continue; const d = r.pos.distanceToSquared(cam); if (d < 70 * 70) vicini.push([d, r]); }
  vicini.sort((a, b) => a[0] - b[0]);
  pool.forEach((o, i) => {
    const r = vicini[i]?.[1];
    o.visible = !!r;
    if (r) { o.position.copy(r.pos); o.element.textContent = (r.testo || '').slice(0, 42); o.element.style.setProperty('--c', TIPI[r.tipo]?.colore || '#fff'); }
  });
}

// ===== Eventi ===========================================================================================
const conta = { buste: 0, nodi: 0, pensieri: [], token: new Map(), risparmio: 0 };
const orologio = new THREE.Clock();

function gestisci(e, istantaneo = false) {
  const t = istantaneo ? -5 : orologio.elapsedTime;
  P.registra(e);
  switch (e.type) {
    case 'agente.assunto': {
      const n = e.ruolo === 'capo-reparto' ? nodi.get(`reparto:${e.reparto}`) : (nodi.get(`imp:${e.agente}`) || neuroneEsterno(e));
      if (!n) return;
      istanze.set(e.id, n); n.attiva(e.id, e);
      if (!istantaneo) voceSemplice(n, 'busta', `Assunto · ${e.modello}/${e.effort} · ${e.titolo}`);
      break;
    }
    case 'agente.stato': { const n = istanze.get(e.id), ist = n?.istanze.get(e.id); if (ist) { ist.stato = e.testo; n.colpo(0.3); n.disegna(); } break; }
    case 'agente.pensiero': {
      const n = istanze.get(e.id), ist = n?.istanze.get(e.id);
      if (!ist) return;
      ist.pensieri.push(e); if (ist.pensieri.length > 60) ist.pensieri.shift();
      cresci(n, ist, e, t, istantaneo);
      if (!istantaneo) { conta.pensieri.push(performance.now()); n.colpo(0.5); }
      break;
    }
    case 'agente.token': {
      const ist = istanze.get(e.id)?.istanze.get(e.id); if (ist) ist.token = e;
      conta.token.set(e.id, (e.input || 0) + (e.output || 0) + (e.cache || 0) + (e.cacheScritta || 0));
      break;
    }
    case 'agente.finito': conta.risparmio += Math.max(0, (e.tokenLavoro || 0) - (e.tokenBusta || 0)); break;
    case 'busta': {
      conta.buste++;
      if (!istantaneo) {
        const seg = segmentiPercorso(e.percorso);
        if (seg.length) impulsi.push(new Impulso(e, seg, e.tipo === 'incarico' ? '#7dd3fc' : coloreAffidabilita(e.affidabilita)));
        ticker({ ...e, da: nomeDi(e.percorso[0]), a: nomeDi(e.percorso.at(-1)) });
      }
      break;
    }
    case 'agente.uscito': {
      const n = istanze.get(e.id); if (!n) return;
      const ist = n.istanze.get(e.id);
      const via = () => { for (const r of ist?.nodi || []) memoria.luce(r, 0.3); n.disattiva(e.id); istanze.delete(e.id); };
      istantaneo ? via() : setTimeout(via, 3500);
      break;
    }
    case 'capo.richiesta': {
      const capo = nodi.get('capo'); capo.colpo(2);
      if (!istantaneo) { richiesta(e.testo); onda(capo.pos, capo.colore, 45); scintille(capo.pos, capo.colore, 60); }
      break;
    }
    case 'vacancy': if (!istantaneo) posizione(e); break;
    case 'demo': statoDemo(e.attiva); break;
    default: break;
  }
}
const nomeDi = (x) => nodi.get(chiaveNodo(x))?.nome || x;

// ===== Interfaccia (pannelli condivisi con l'ufficio) =========================================================
const $ = (id) => document.getElementById(id);
const hex = (c) => `#${c.getHexString()}`;
let P = null; // creati dopo il caricamento dell'organico

function metriche() {
  const adesso = performance.now(); conta.pensieri = conta.pensieri.filter((x) => adesso - x < 60000);
  const tok = [...conta.token.values()].reduce((a, b) => a + b, 0);
  P.metriche([['agenti svegli', istanze.size], ['nodi', memoria.n], ['memoria', sapere.size], ['pensieri/min', conta.pensieri.length],
    ['buste', conta.buste], ['token lavoro', tok], ['fuori dal Capo', conta.risparmio]]);
  $('ritmo').textContent = `${conta.pensieri.length}/min`;
}
function voceCoscienza(rec, n) { P.voce({ nome: n.nome, colore: hex(n.colore), tipo: rec.tipo, testo: rec.testo, onclick: () => { volaVerso(rec.pos, 16); apriNodo(rec); } }); }
function voceSemplice(n, tipo, testo) { P.voce({ nome: n.nome, colore: hex(n.colore), tipo, testo, onclick: () => { volaVerso(n.pos, n.raggio * 9 + 14); apriNeurone(n); } }); }
const ticker = (e) => P.ticker(e);
const richiesta = (t) => P.richiesta(t);
const posizione = (e) => P.posizione(e);
const apriBusta = (e) => P.apriBusta(e);

function apriNodo(r) {
  P.mostraDettaglio(() => {
    const s = P.registro.get(r.idIstanza), c = TIPI[r.tipo]?.colore || '#fff';
    $('dettaglio').innerHTML = `<h3 class="tit">Nodo <span>${esc(TIPI[r.tipo]?.nome || r.tipo)}</span></h3>
      <div class="pensiero-grande" style="--c:${c}">${esc(r.testo || '')}</div>
      ${r.usi ? `<div class="sotto">Fonte di memoria condivisa, usata ${r.usi} volte</div>` : ''}
      ${s ? `<h3 class="tit" style="margin-top:14px">Il lavoro di cui fa parte <span>${s.passi.length} passi</span></h3>${P.testaLavoro(s)}${P.htmlLavoro(s, r)}` : ''}`;
    $('dettaglio').querySelector('.evidenza')?.scrollIntoView({ block: 'center' });
  });
}
function apriNeurone(n) {
  const d = n.dati || {};
  P.apriLavori({
    titolo: n.tipo === 'capo' ? 'Direzione' : n.tipo === 'rep' ? 'Capo reparto' : 'Impiegato', stato: n.istanze.size ? 'sveglio' : 'dorme',
    nome: n.nome, colore: hex(n.colore),
    sottotitolo: `${esc(d.mansione || (n.tipo === 'rep' ? 'Verifica le buste sotto soglia' : n.tipo === 'capo' ? 'La chat che ha aperto Sinapsi' : ''))}${d.modello ? ` · default ${esc(d.modello)}/${esc(d.effort)}` : ''}`,
    filtro: (s) => (n.tipo === 'rep' ? s.capoRep && `reparto:${s.info.reparto}` === n.chiave : !s.capoRep && `imp:${s.info.agente}` === n.chiave),
  });
}
function vaiA(s, p) {
  if (p?.nodo) return volaVerso(p.nodo.pos, 16);
  const n = nodi.get(s.capoRep ? `reparto:${s.info.reparto}` : `imp:${s.info.agente}`);
  if (n) volaVerso(n.pos, n.raggio * 9 + 14);
}

let demoOn = false;
function statoDemo(on) { demoOn = on; $('bDemo').textContent = on ? '■ Demo' : '▶ Demo'; $('bDemo').classList.toggle('on', on); }
$('bDemo').onclick = () => demo(!demoOn).then((r) => statoDemo(r.demo));

// ===== Navigazione ========================================================================================
const orbita = new OrbitControls(camera, renderer.domElement);
Object.assign(orbita, { enableDamping: true, dampingFactor: 0.055, autoRotate: true, autoRotateSpeed: 0.18, minDistance: 2, maxDistance: 2200 });
let tocco = 0;
orbita.addEventListener('start', () => { orbita.autoRotate = false; tocco = performance.now(); cinema = false; $('bCinema').classList.remove('on'); });
const volo = new PointerLockControls(camera, document.body);
let modo = 'orbita', cinema = false, viaggio = null;
const tasti = new Set(), vel = new THREE.Vector3();
addEventListener('keydown', (e) => {
  tasti.add(e.code); if (e.repeat) return;
  if (e.code === 'KeyF') modo === 'volo' ? volo.unlock() : volo.lock();
  if (e.code === 'KeyC' && modo !== 'volo') attivaCinema(!cinema);
});
addEventListener('keyup', (e) => tasti.delete(e.code));
volo.addEventListener('lock', () => { modo = 'volo'; orbita.enabled = false; viaggio = null; cinema = false; $('mirino').classList.remove('nascosto'); $('bVolo').classList.add('on'); $('bOrbita').classList.remove('on'); });
volo.addEventListener('unlock', () => {
  modo = 'orbita'; const av = new THREE.Vector3(); camera.getWorldDirection(av);
  orbita.target.copy(camera.position).addScaledVector(av, 50); orbita.enabled = true; orbita.update();
  $('mirino').classList.add('nascosto'); $('bVolo').classList.remove('on'); $('bOrbita').classList.add('on');
});
$('bVolo').onclick = () => volo.lock();
$('bOrbita').onclick = () => { if (modo === 'volo') volo.unlock(); attivaCinema(false); };
$('bCinema').onclick = () => attivaCinema(!cinema);
function attivaCinema(on) { cinema = on; $('bCinema').classList.toggle('on', on); prossimoTaglio = 0; }

function voloLibero(dt) {
  const x = (tasti.has('KeyD') || tasti.has('ArrowRight')) - (tasti.has('KeyA') || tasti.has('ArrowLeft'));
  const y = (tasti.has('Space') || tasti.has('KeyE')) - (tasti.has('KeyQ') || tasti.has('ControlLeft'));
  const z = (tasti.has('KeyW') || tasti.has('ArrowUp')) - (tasti.has('KeyS') || tasti.has('ArrowDown'));
  const av = new THREE.Vector3(); camera.getWorldDirection(av);
  const dx = new THREE.Vector3().crossVectors(av, camera.up).normalize();
  const sp = new THREE.Vector3().addScaledVector(dx, x).addScaledVector(camera.up, y).addScaledVector(av, z);
  if (sp.lengthSq()) sp.normalize().multiplyScalar(tasti.has('ShiftLeft') ? 600 : 150);
  vel.addScaledVector(sp, dt).multiplyScalar(Math.exp(-dt * 3)); camera.position.addScaledVector(vel, dt);
}
function volaVerso(p, dist) {
  const dir = camera.position.clone().sub(p).normalize();
  viaggio = { da: camera.position.clone(), a: p.clone().addScaledVector(dir, dist), t0: orbita.target.clone(), t1: p.clone(), t: 0, dur: 1.6 };
  orbita.autoRotate = false; tocco = performance.now();
}
const morbido = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

// regia automatica: segue l'impulso o il ramo di pensiero più recente
let prossimoTaglio = 0;
function regia(t) {
  if (!cinema || viaggio || t < prossimoTaglio) return;
  prossimoTaglio = t + 7;
  const imp = impulsi.find((i) => !i.fine);
  const ultimo = memoria.nodi.at(-1);
  const bersaglio = imp ? imp.pos : ultimo && ultimo.neurone ? ultimo.pos : nodi.get('capo').pos;
  const lato = new THREE.Vector3().randomDirection(); lato.y = Math.abs(lato.y) * 0.6;
  const dist = imp ? 70 : 38;
  viaggio = { da: camera.position.clone(), a: bersaglio.clone().addScaledVector(lato, dist), t0: orbita.target.clone(), t1: bersaglio.clone(), t: 0, dur: 2.6 };
  orbita.autoRotate = true;
}

// ===== Selezione ===========================================================================================
const raggio = new THREE.Raycaster(); raggio.params.Points.threshold = 1.4;
const ptr = new THREE.Vector2();
let premuto = null, rallenta = 1;
function colpito(x, y, soloImpulsi = false) {
  modo === 'volo' ? ptr.set(0, 0) : ptr.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raggio.setFromCamera(ptr, camera);
  const b = impulsi.filter((i) => !i.fine).map((i) => i.sprite);
  if (!soloImpulsi) for (const n of nodi.values()) b.push(n.soma);
  const h = raggio.intersectObjects(b, false)[0];
  if (h) return h.object.userData.impulso || h.object.userData.neurone;
  if (soloImpulsi) return null;
  const hp = raggio.intersectObject(memoria.punti, false)[0];
  return hp ? memoria.nodi[hp.index] : null;
}
function scegli(c) {
  if (!c) return;
  if (c instanceof Impulso) apriBusta({ ...c.ev, da: nomeDi(c.ev.percorso[0]), a: nomeDi(c.ev.percorso.at(-1)) });
  else if (c instanceof Neurone) apriNeurone(c);
  else apriNodo(c);
}
renderer.domElement.addEventListener('pointerdown', (e) => { premuto = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => { if (modo !== 'volo' && premuto && Math.hypot(e.clientX - premuto.x, e.clientY - premuto.y) < 5) scegli(colpito(e.clientX, e.clientY)); });
document.body.addEventListener('click', () => { if (modo === 'volo') scegli(colpito(0, 0)); });
renderer.domElement.addEventListener('dblclick', (e) => { const c = colpito(e.clientX, e.clientY); if (c instanceof Neurone) volaVerso(c.pos, c.raggio * 9 + 14); else if (c?.pos) volaVerso(c.pos, 14); });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (modo === 'volo') return;
  const c = colpito(e.clientX, e.clientY, true); rallenta = c ? 0.08 : 1; renderer.domElement.style.cursor = c ? 'crosshair' : '';
});

// ===== Ciclo ==================================================================================================
let scala = 1, frame = 0;
function ciclo() {
  requestAnimationFrame(ciclo);
  const dt = Math.min(orologio.getDelta(), 0.05), t = orologio.elapsedTime;
  scala += (rallenta - scala) * Math.min(1, dt * 10);
  if (modo === 'volo') voloLibero(dt);
  else {
    regia(t);
    if (viaggio) {
      viaggio.t = Math.min(1, viaggio.t + dt / viaggio.dur); const k = morbido(viaggio.t);
      camera.position.lerpVectors(viaggio.da, viaggio.a, k); orbita.target.lerpVectors(viaggio.t0, viaggio.t1, k);
      if (viaggio.t >= 1) viaggio = null;
    }
    if (!orbita.autoRotate && !cinema && performance.now() - tocco > 30000) orbita.autoRotate = true;
    orbita.update();
  }
  for (const n of nodi.values()) n.aggiorna(dt, t);
  for (const s of sinapsi.values()) s.aggiorna(dt);
  for (let i = impulsi.length - 1; i >= 0; i--) if (!impulsi[i].aggiorna(dt * scala)) { impulsi[i].distruggi(); impulsi.splice(i, 1); }
  for (let i = onde.length - 1; i >= 0; i--) { const o = onde[i]; o.t += dt; o.s.scale.setScalar(o.dim * (0.1 + o.t * 1.2)); o.s.material.opacity = Math.max(0, 0.45 - o.t * 0.6); if (o.t > 0.8) { scena.remove(o.s); onde.splice(i, 1); } }
  for (let i = sciami.length - 1; i >= 0; i--) {
    const s = sciami[i]; s.t += dt; const p = s.pt.geometry.attributes.position;
    s.v.forEach((v, k) => { p.setXYZ(k, p.getX(k) + v.x * dt, p.getY(k) + v.y * dt, p.getZ(k) + v.z * dt); v.multiplyScalar(Math.exp(-dt * 2)); });
    p.needsUpdate = true; s.pt.material.opacity = Math.max(0, 0.7 - s.t * 0.7); if (s.t > 1) { scena.remove(s.pt); sciami.splice(i, 1); }
  }
  for (let i = carte.length - 1; i >= 0; i--) if (performance.now() - carte[i].t > 7600) { scena.remove(carte[i].o); carte.splice(i, 1); }
  const capo = nodi.get('capo');
  galassia.material.uniforms.uTempo.value = t; galassia.material.uniforms.uAtt.value = capo.livello;
  giroscopi.forEach((g) => { g.rotation.x += g.userData.v.x * dt; g.rotation.y += g.userData.v.y * dt + dt * 0.1; g.rotation.z += g.userData.v.z * dt; });
  flusso.mat.uniforms.uTempo.value = t; dendriti.linee.material.uniforms.uTempo.value = t;
  memoria.matPunti.uniforms.uTempo.value = t; memoria.linee.material.uniforms.uTempo.value = t;
  nebulosa.material.uniforms.uTempo.value = t; lente.uniforms.uTempo.value = t;
  pulviscolo.rotation.y += dt * 0.006; nebulosa.position.copy(camera.position);
  if (++frame % 12 === 0) {
    aggiornaPool();
    for (const n of nodi.values()) if (n.tipo === 'imp') n.div.style.display = n.istanze.size || n.pos.distanceTo(camera.position) < 80 ? '' : 'none';
    for (const s of sapere.values()) if (s.etichetta) s.etichetta.visible = s.pos.distanceTo(camera.position) < 340;
    for (const c of carte) c.o.visible = c.o.position.distanceTo(camera.position) < 240;
  }
  composer.render();
  etichette.render(scena, camera);
}

// ===== Avvio =========================================================================================================
azienda = (await caricaAzienda()).azienda;
costruisciRete();
flusso.mat.uniforms.uPx.value = galassia.material.uniforms.uPx.value = memoria.matPunti.uniforms.uPx.value = PX();
P = creaPannelli({ azienda, nomeDi, vaiA });
metriche();
setInterval(metriche, 500);
collegaStream({
  replay: (d) => {
    statoDemo(d.demo);
    memoria.blocco = true;
    for (const e of d.eventi) gestisci(e, true);
    memoria.fineBlocco();
    for (const s of sapere.values()) etichettaSapere(s);
  },
  evento: (e) => gestisci(e),
});
ciclo();
