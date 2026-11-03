// Mini Claude: gli impiegati di Sinapsi. Corpo a goccia terracotta, occhioni, stellina sulla testa,
// cuffie del colore del reparto e badge del colore del modello.
import * as THREE from 'three';

const TERRACOTTA = '#d97757';
const pelle = new THREE.MeshPhysicalMaterial({ color: TERRACOTTA, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color('#ffd2bf') });
const pelleScura = new THREE.MeshPhysicalMaterial({ color: '#b85e42', roughness: 0.5, clearcoat: 0.4 });
const nero = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.25 });
const bianco = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const rosa = new THREE.MeshBasicMaterial({ color: '#ff9e9e', transparent: true, opacity: 0.55, depthWrite: false });
const stella = new THREE.MeshStandardMaterial({ color: '#f6b08f', emissive: '#e8825f', emissiveIntensity: 0.35, roughness: 0.4 });
const oro = new THREE.MeshStandardMaterial({ color: '#f5c451', metalness: 0.85, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.25 });
const blu = new THREE.MeshStandardMaterial({ color: '#1e2a4a', roughness: 0.6 });

const GEO = {
  corpo: new THREE.LatheGeometry([[0, 0], [0.16, 0.01], [0.23, 0.07], [0.26, 0.18], [0.25, 0.32], [0.21, 0.43], [0.13, 0.5], [0, 0.52]].map(([x, y]) => new THREE.Vector2(x, y)), 32),
  testa: new THREE.SphereGeometry(0.235, 32, 24),
  occhio: new THREE.SphereGeometry(0.042, 16, 12),
  luce: new THREE.SphereGeometry(0.013, 8, 6),
  guancia: new THREE.CircleGeometry(0.035, 16),
  bocca: new THREE.TorusGeometry(0.03, 0.007, 6, 16, Math.PI),
  raggio: new THREE.CapsuleGeometry(0.018, 0.075, 4, 8),
  braccio: new THREE.CapsuleGeometry(0.055, 0.17, 6, 10),
  gamba: new THREE.CapsuleGeometry(0.065, 0.1, 6, 10),
  piede: new THREE.SphereGeometry(0.075, 14, 10),
  archetto: new THREE.TorusGeometry(0.245, 0.018, 8, 32, Math.PI),
  cuffia: new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20),
  asta: new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6),
  badge: new THREE.BoxGeometry(0.085, 0.11, 0.01),
  cordino: new THREE.TorusGeometry(0.13, 0.008, 6, 24),
  lente: new THREE.TorusGeometry(0.05, 0.009, 8, 20),
  cravatta: new THREE.ConeGeometry(0.035, 0.16, 4),
};

export class Omino {
  constructor({ coloreReparto = '#7dd3fc', coloreModello = '#60a5fa', ruolo = 'impiegato' } = {}) {
    this.ruolo = ruolo;
    this.g = new THREE.Group();
    this.corpoG = new THREE.Group(); this.g.add(this.corpoG);
    const ombra = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

    const corpo = ombra(new THREE.Mesh(GEO.corpo, ruolo === 'capo' ? blu : pelle)); corpo.position.y = 0.17; this.corpoG.add(corpo);
    if (ruolo === 'capo') { const pancia = ombra(new THREE.Mesh(GEO.corpo, pelle)); pancia.scale.set(0.55, 0.9, 0.62); pancia.position.set(0, 0.19, 0.1); this.corpoG.add(pancia); }

    this.testaG = new THREE.Group(); this.testaG.position.y = 0.86; this.corpoG.add(this.testaG);
    this.testaG.add(ombra(new THREE.Mesh(GEO.testa, pelle)));
    this.occhi = [-1, 1].map((s) => {
      const o = new THREE.Mesh(GEO.occhio, nero); o.position.set(s * 0.082, 0.03, 0.2); o.scale.set(0.85, 1.15, 0.6);
      const l = new THREE.Mesh(GEO.luce, bianco); l.position.set(0.012, 0.018, 0.035); o.add(l);
      this.testaG.add(o); return o;
    });
    for (const s of [-1, 1]) { const gu = new THREE.Mesh(GEO.guancia, rosa); gu.position.set(s * 0.15, -0.04, 0.185); gu.rotation.y = s * 0.55; this.testaG.add(gu); }
    const bocca = new THREE.Mesh(GEO.bocca, nero); bocca.position.set(0, -0.055, 0.218); bocca.rotation.z = Math.PI; this.testaG.add(bocca);

    // stellina sulla testa
    this.stella = new THREE.Group(); this.stella.position.y = 0.3;
    for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(GEO.raggio, ruolo === 'capo' ? oro : stella); r.rotation.z = (i / 8) * Math.PI; this.stella.add(r); }
    const asta = new THREE.Mesh(GEO.asta, ruolo === 'capo' ? oro : stella); asta.position.y = -0.07; asta.scale.y = 0.5; this.stella.add(asta);
    this.testaG.add(this.stella);

    // cuffie del reparto (non per il Capo)
    if (ruolo !== 'capo') {
      const mr = new THREE.MeshStandardMaterial({ color: coloreReparto, roughness: 0.35, metalness: 0.2 });
      const arco = new THREE.Mesh(GEO.archetto, mr); arco.rotation.y = Math.PI / 2; arco.position.y = 0.02; this.testaG.add(arco);
      for (const s of [-1, 1]) { const c = ombra(new THREE.Mesh(GEO.cuffia, mr)); c.rotation.z = Math.PI / 2; c.position.set(s * 0.235, 0, 0); this.testaG.add(c); }
      const mic = new THREE.Mesh(GEO.asta, mr); mic.rotation.set(Math.PI / 2.3, 0, 0.9); mic.position.set(-0.18, -0.09, 0.1); this.testaG.add(mic);
    }
    if (ruolo === 'capo-reparto') {
      for (const s of [-1, 1]) { const l = new THREE.Mesh(GEO.lente, nero); l.position.set(s * 0.085, 0.03, 0.215); this.testaG.add(l); }
      const cr = new THREE.Mesh(GEO.cravatta, new THREE.MeshStandardMaterial({ color: coloreReparto, roughness: 0.5 })); cr.rotation.x = Math.PI; cr.position.set(0, 0.52, 0.25); this.corpoG.add(cr);
    }
    if (ruolo === 'capo') { const cr = new THREE.Mesh(GEO.cravatta, oro); cr.rotation.x = Math.PI; cr.position.set(0, 0.5, 0.255); this.corpoG.add(cr); }

    // badge con il colore del modello
    this.badgeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: coloreModello, emissiveIntensity: 0.9 });
    const cord = new THREE.Mesh(GEO.cordino, nero); cord.rotation.x = Math.PI / 2.4; cord.position.set(0, 0.6, 0.06); this.corpoG.add(cord);
    this.badge = new THREE.Mesh(GEO.badge, this.badgeMat); this.badge.position.set(0, 0.42, 0.25); this.badge.rotation.x = -0.15; this.corpoG.add(this.badge);
    this.badge.visible = ruolo !== 'capo-reparto';

    // braccia e gambe con perno
    this.braccia = [-1, 1].map((s) => {
      const p = new THREE.Group(); p.position.set(s * 0.25, 0.58, 0); this.corpoG.add(p);
      const b = ombra(new THREE.Mesh(GEO.braccio, ruolo === 'capo' ? blu : pelle)); b.position.y = -0.11; p.add(b);
      const mano = new THREE.Mesh(GEO.piede, pelle); mano.scale.setScalar(0.62); mano.position.y = -0.23; p.add(mano);
      p.rotation.z = s * 0.18; return p;
    });
    this.gambe = [-1, 1].map((s) => {
      const p = new THREE.Group(); p.position.set(s * 0.1, 0.2, 0); this.g.add(p);
      const gm = ombra(new THREE.Mesh(GEO.gamba, pelleScura)); gm.position.y = -0.08; p.add(gm);
      const pi = ombra(new THREE.Mesh(GEO.piede, pelleScura)); pi.scale.set(1, 0.6, 1.35); pi.position.set(0, -0.17, 0.04); p.add(pi);
      return p;
    });

    this.g.traverse((o) => { o.userData.omino = this; });
    this.stato = 'fermo'; this.fase = Math.random() * 10; this.prossimoBattito = 2 + Math.random() * 3; this.battito = 0;
    this.sguardo = 0; this.sguardoObiettivo = 0; this.badgeT = 0;
  }

  modello(colore) { this.badgeMat.emissive.set(colore); this.badge.visible = true; }

  // badge sollevato verso il lettore del tornello
  timbra() { this.badgeT = 0.9; }

  aggiorna(dt, t) {
    const f = this.fase;
    // occhi che sbattono
    this.prossimoBattito -= dt;
    if (this.prossimoBattito <= 0) { this.battito = 0.14; this.prossimoBattito = 2 + Math.random() * 4; }
    if (this.battito > 0) this.battito -= dt;
    const chiusi = this.battito > 0 ? 0.1 : 1.15;
    for (const o of this.occhi) o.scale.y += (chiusi - o.scale.y) * Math.min(1, dt * 30);
    if (Math.random() < dt * 0.3) this.sguardoObiettivo = (Math.random() - 0.5) * 0.9;
    this.sguardo += (this.sguardoObiettivo - this.sguardo) * Math.min(1, dt * 3);
    this.stella.rotation.y += dt * 0.8;

    const [bS, bD] = this.braccia, [gS, gD] = this.gambe;
    if (this.stato === 'cammina') {
      const p = Math.sin(t * 11 + f);
      gS.rotation.x = p * 0.6; gD.rotation.x = -p * 0.6;
      bS.rotation.x = -p * 0.5; bD.rotation.x = p * 0.5;
      this.corpoG.position.y = Math.abs(Math.cos(t * 11 + f)) * 0.05;
      this.corpoG.rotation.z = p * 0.06; this.corpoG.rotation.x = 0.05;
      this.testaG.rotation.y = 0;
    } else if (this.stato === 'seduto') {
      gS.rotation.x = gD.rotation.x = -1.45;
      const scrive = this.inattivo ? 0 : 1;
      bS.rotation.x = -1.05 + Math.sin(t * 14 + f) * 0.12 * scrive;
      bD.rotation.x = -1.05 + Math.sin(t * 14 + f + 1.7) * 0.12 * scrive;
      this.corpoG.position.y = Math.sin(t * 1.6 + f) * 0.008;
      this.corpoG.rotation.set(0.08, 0, 0);
      this.testaG.rotation.y = this.sguardo * 0.4; this.testaG.rotation.x = -0.05 + Math.sin(t * 0.7 + f) * 0.04;
    } else {
      gS.rotation.x += (0 - gS.rotation.x) * Math.min(1, dt * 8); gD.rotation.x += (0 - gD.rotation.x) * Math.min(1, dt * 8);
      bS.rotation.x = Math.sin(t * 1.5 + f) * 0.05; bD.rotation.x = -Math.sin(t * 1.5 + f) * 0.05;
      this.corpoG.position.y = Math.sin(t * 2 + f) * 0.01; this.corpoG.rotation.set(0, 0, 0);
      this.testaG.rotation.y = this.sguardo;
    }
    if (this.badgeT > 0) { this.badgeT -= dt; bD.rotation.x = -1.6; bD.rotation.z = 0.25; } else bD.rotation.z = 0.18;
  }
}
