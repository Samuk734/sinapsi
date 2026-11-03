// Contenuti disegnati su canvas: schermi dei PC (a tema per reparto e dal vivo),
// TV di reparto, lavagne, poster, insegne e textures dei materiali.
import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a);
const sceglie = (arr) => arr[(Math.random() * arr.length) | 0];

export function texturaCanvas(w, h, disegna, { srgb = true, ripeti } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  disegna(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (ripeti) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...ripeti); }
  t.anisotropy = 8;
  return t;
}

// ---- Materiali ---------------------------------------------------------------------------
export function parquet() {
  return texturaCanvas(1024, 1024, (g, W, H) => {
    const righe = 8, lungh = [256, 384, 512];
    for (let r = 0; r < righe; r++) {
      let x = -((r * 137) % 300);
      while (x < W) {
        const L = sceglie(lungh), y = r * (H / righe), h = H / righe;
        const base = [rnd(170, 205), rnd(130, 158), rnd(92, 112)];
        g.fillStyle = `rgb(${base.map((v) => v | 0)})`; g.fillRect(x, y, L, h);
        for (let k = 0; k < 26; k++) {
          g.strokeStyle = `rgba(${90 + rnd(-20, 20)},${60 + rnd(-15, 15)},${35},${rnd(0.05, 0.18)})`;
          g.lineWidth = rnd(0.6, 2.2); g.beginPath();
          const yy = y + rnd(2, h - 2); g.moveTo(x, yy);
          for (let s = 0; s <= 8; s++) g.lineTo(x + (L * s) / 8, yy + Math.sin(s * rnd(0.5, 1.5)) * rnd(0.5, 2.5));
          g.stroke();
        }
        g.fillStyle = 'rgba(40,25,15,0.55)'; g.fillRect(x, y, 2, h); g.fillRect(x, y, L, 1.5);
        x += L;
      }
    }
  }, { ripeti: [10, 10] });
}

export function rumore(base, varia = 18, scala = 256, ripeti = [6, 6]) {
  return texturaCanvas(scala, scala, (g, W, H) => {
    const img = g.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const v = (Math.random() - 0.5) * varia;
      img.data[i * 4] = base[0] + v; img.data[i * 4 + 1] = base[1] + v; img.data[i * 4 + 2] = base[2] + v; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { ripeti });
}

export function insegnaReparto(nome, colore) {
  return texturaCanvas(1024, 160, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.78)'; g.fillRect(0, 22, W, H - 44);
    g.fillStyle = colore; g.fillRect(0, 22, 14, H - 44);
    g.fillStyle = '#1d2230'; g.font = '700 64px "Segoe UI", sans-serif'; g.textBaseline = 'middle';
    g.fillText(nome.toUpperCase(), 44, H / 2 + 2);
  });
}

export function finestreCitta(lit = 0.35) {
  return texturaCanvas(256, 512, (g, W, H) => {
    g.fillStyle = '#0d1220'; g.fillRect(0, 0, W, H);
    for (let y = 6; y < H; y += 16) for (let x = 6; x < W; x += 14) {
      const on = Math.random() < lit;
      g.fillStyle = on ? sceglie(['#ffd9a0', '#ffe8c2', '#cfe4ff', '#ffc477']) : `rgba(40,55,80,${rnd(0.4, 0.9)})`;
      g.fillRect(x, y, 9, 10);
    }
  });
}

// ---- Poster, lavagne, decorazioni a tema -----------------------------------------------------
export function lavagna(tema, colore) {
  return texturaCanvas(1024, 600, (g, W, H) => {
    g.fillStyle = '#f7f8f6'; g.fillRect(0, 0, W, H);
    g.lineWidth = 3; g.font = '28px "Segoe Print", "Comic Sans MS", cursive';
    const penne = ['#1f3a93', '#0b0b0b', '#b0201c', '#1a7d3a'];
    if (tema === 'formule') {
      const f = ['P = I²·R', 'Tj = Ta + P·Rθja', 'ΔV = ρ·L·I / S', 'f₀ = 1 / (2π√LC)', 'σ = M·y / I', 'Q = C·V', 'τ = R·C', 'η = Pout / Pin', '∇·E = ρ/ε₀', 'E = ½·C·V²'];
      f.forEach((t, i) => { g.fillStyle = penne[i % 4]; g.fillText(t, 40 + (i % 2) * 480, 70 + Math.floor(i / 2) * 105); });
      g.strokeStyle = '#b0201c'; g.beginPath(); g.ellipse(700, 290, 190, 46, 0, 0, Math.PI * 2); g.stroke();
    } else if (tema === 'architettura' || tema === 'wireframe') {
      g.strokeStyle = penne[0];
      const box = (x, y, w, h, t) => { g.strokeRect(x, y, w, h); g.fillStyle = penne[1]; g.fillText(t, x + 12, y + h / 2 + 10); };
      if (tema === 'architettura') {
        box(60, 60, 220, 90, 'UI'); box(400, 60, 240, 90, 'API'); box(740, 60, 220, 90, 'Worker');
        box(400, 300, 240, 90, 'Core'); box(60, 450, 220, 90, 'Driver'); box(740, 450, 220, 90, 'DB');
        g.beginPath(); [[280, 105, 400, 105], [640, 105, 740, 105], [520, 150, 520, 300], [400, 345, 170, 450], [640, 345, 850, 450]].forEach(([a, b, c, d]) => { g.moveTo(a, b); g.lineTo(c, d); }); g.stroke();
      } else {
        g.strokeRect(60, 40, 900, 520); g.strokeRect(60, 40, 900, 70); g.strokeRect(90, 150, 400, 220); g.strokeRect(530, 150, 400, 60);
        for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(530, 240 + i * 30); g.lineTo(900 - i * 40, 240 + i * 30); g.stroke(); }
        [90, 390, 690].forEach((x) => g.strokeRect(x, 400, 240, 130));
      }
    } else if (tema === 'kanban') {
      const col = ['DA FARE', 'IN CORSO', 'TEST', 'FATTO'];
      col.forEach((c, i) => {
        g.fillStyle = '#333'; g.font = '700 26px "Segoe UI"'; g.fillText(c, 40 + i * 250, 50);
        g.strokeStyle = '#999'; g.beginPath(); g.moveTo(20 + i * 250, 20); g.lineTo(20 + i * 250, H - 20); g.stroke();
        for (let k = 0; k < 3 + ((Math.random() * 3) | 0); k++) {
          g.fillStyle = sceglie(['#fff27a', '#ffb3c7', '#a7e9ff', '#b8f5a0']); g.fillRect(40 + i * 250 + rnd(-6, 6), 80 + k * 110, 190, 90);
        }
      });
    } else if (tema === 'moodboard') {
      for (let i = 0; i < 14; i++) { g.fillStyle = `hsl(${rnd(0, 360)},${rnd(40, 80)}%,${rnd(45, 70)}%)`; g.fillRect(rnd(20, W - 220), rnd(20, H - 180), rnd(120, 220), rnd(90, 170)); }
    } else {
      for (let i = 0; i < 9; i++) { g.strokeStyle = penne[i % 4]; g.beginPath(); g.moveTo(50, 60 + i * 58); g.lineTo(rnd(400, 950), 60 + i * 58); g.stroke(); }
    }
    g.fillStyle = colore; g.fillRect(0, H - 10, W, 10);
  });
}

export function posterSchema() {
  return texturaCanvas(840, 600, (g, W, H) => {
    g.fillStyle = '#fdfdf8'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#8a1c1c'; g.lineWidth = 2; g.strokeRect(10, 10, W - 20, H - 20);
    disegnaSchema(g, W, H, '#1d3f8a');
    g.fillStyle = '#222'; g.font = '16px Consolas'; g.fillText('BLDC_POWER_STAGE  Rev B  Sheet 2/5', W - 360, H - 24);
  });
}

function disegnaSchema(g, W, H, colore) {
  g.strokeStyle = colore; g.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const x = 80 + (i % 3) * 240, y = 90 + Math.floor(i / 3) * 230;
    g.strokeRect(x, y, 90, 120);
    for (let p = 0; p < 4; p++) { g.beginPath(); g.moveTo(x - 30, y + 20 + p * 27); g.lineTo(x, y + 20 + p * 27); g.moveTo(x + 90, y + 20 + p * 27); g.lineTo(x + 130, y + 20 + p * 27); g.stroke(); }
    g.beginPath(); let zx = x + 130, zy = y + 47;
    g.moveTo(zx, zy); for (let k = 0; k < 6; k++) { zx += 8; g.lineTo(zx, zy + (k % 2 ? -8 : 8)); } g.lineTo(zx + 30, zy); g.stroke();
  }
}

// ---- Schermi dei PC: sfondo a tema + attività dal vivo ------------------------------------------------
const STILI = {
  software: 'codice', web: 'browser', grafica: 'grafica', reverse: 'hex', schematici: 'schema', pcb: 'pcb', ingegneria: 'grafico',
  diagnostica: 'oscillo', normative: 'documento', disegno: 'cad', precisione: 'cad', cablaggi: 'cablaggio', ricerca: 'ricerca',
  fisica: 'calore', qualita: 'test', documentazione: 'documento',
};

const CODICE = ['void TIM1_UP_IRQHandler(void) {', '  uint16_t ia = adc_read(CH_A);', '  foc_update(&motor, ia, ib);', '  if (fault) pwm_disable();', '}', 'static int eeprom_load(void) {', '  for (p = 0; p < EE_PAGES; p++) {', '    wdt_feed();', '    i2c_read_page(p, buf);', '  }', 'export async function getStato() {', "  const r = await fetch('/api');", '  return r.json();', '}'];

export function disegnaSchermo(g, W, H, reparto, colore, t, vivo) {
  const stile = STILI[reparto] || 'codice';
  sfondo(g, W, H, stile, t);
  if (!vivo) return;
  // barra titolo con l'agente e pannello attività in basso
  g.fillStyle = 'rgba(10,14,24,0.85)'; g.fillRect(0, 0, W, 34);
  g.fillStyle = colore; g.fillRect(0, 0, 6, 34);
  g.fillStyle = '#fff'; g.font = '600 17px "Segoe UI", sans-serif'; g.fillText(vivo.titolo.slice(0, 40), 16, 23);
  g.fillStyle = vivo.coloreModello; g.font = '700 13px Consolas'; g.fillText(vivo.modello.toUpperCase(), W - 92, 22);
  const hP = 26 * Math.min(5, vivo.righe.length) + 14;
  g.fillStyle = 'rgba(6,9,16,0.9)'; g.fillRect(0, H - hP, W, hP);
  vivo.righe.slice(-5).forEach((r, i) => {
    g.fillStyle = r.colore; g.font = `${r.tipo === 'pensiero' ? 'italic ' : ''}15px Consolas, monospace`;
    g.fillText(`${r.icona} ${r.testo}`.slice(0, 58), 12, H - hP + 22 + i * 26);
  });
  if ((t * 2 | 0) % 2) { g.fillStyle = colore; g.fillRect(12 + 9 * Math.min(58, (vivo.righe.at(-1)?.testo.length || 0) + 2), H - 22, 9, 16); }
}

function sfondo(g, W, H, stile, t) {
  switch (stile) {
    case 'codice': {
      g.fillStyle = '#1e1f26'; g.fillRect(0, 0, W, H);
      const off = (t * 1.5) | 0;
      for (let i = 0; i < 18; i++) {
        const riga = CODICE[(i + off) % CODICE.length];
        g.fillStyle = '#5c6370'; g.font = '14px Consolas'; g.fillText(String(i + 1 + off).padStart(3), 6, 50 + i * 21);
        g.fillStyle = sceglieColore(riga); g.fillText(riga, 46, 50 + i * 21);
      }
      break;
    }
    case 'browser': {
      g.fillStyle = '#f3f4f6'; g.fillRect(0, 0, W, H); g.fillStyle = '#d1d5db'; g.fillRect(0, 34, W, 30);
      g.fillStyle = '#fff'; g.fillRect(60, 40, W - 120, 18);
      g.fillStyle = '#1e293b'; g.fillRect(0, 64, W, 60); g.fillStyle = '#38bdf8'; g.fillRect(30, 84, 120, 20);
      g.fillStyle = '#e0f2fe'; g.fillRect(30, 140, W - 60, 120); g.fillStyle = '#0f172a'; g.font = '700 26px "Segoe UI"'; g.fillText('Controllo motori BLDC', 50, 190);
      for (let i = 0; i < 3; i++) { g.fillStyle = '#fff'; g.fillRect(30 + i * ((W - 60) / 3), 280, (W - 90) / 3, 120); g.fillStyle = '#94a3b8'; g.fillRect(45 + i * ((W - 60) / 3), 300, 80, 10); }
      break;
    }
    case 'grafica': {
      g.fillStyle = '#2b2b30'; g.fillRect(0, 0, W, H); g.fillStyle = '#3a3a40'; g.fillRect(0, 34, 60, H); g.fillRect(W - 120, 34, 120, H);
      g.fillStyle = '#fff'; g.fillRect(90, 60, W - 240, H - 100);
      for (let i = 0; i < 5; i++) { g.fillStyle = `hsl(${(i * 70 + t * 20) % 360},70%,60%)`; g.beginPath(); g.arc(160 + i * 70, 200 + Math.sin(t + i) * 30, 34, 0, Math.PI * 2); g.fill(); }
      for (let i = 0; i < 8; i++) { g.fillStyle = `hsl(${i * 45},70%,55%)`; g.fillRect(W - 100, 60 + i * 34, 80, 26); }
      break;
    }
    case 'hex': {
      g.fillStyle = '#0b0f14'; g.fillRect(0, 0, W, H); g.font = '13px Consolas';
      for (let i = 0; i < 19; i++) {
        const a = (0x08000400 + (i + ((t * 3) | 0)) * 16).toString(16).toUpperCase();
        g.fillStyle = '#5eead4'; g.fillText(a, 8, 50 + i * 20);
        g.fillStyle = '#e2e8f0'; g.fillText(Array.from({ length: 8 }, () => ((Math.random() * 256) | 0).toString(16).padStart(2, '0')).join(' '), 100, 50 + i * 20);
        g.fillStyle = '#fbbf24'; g.fillText(sceglie(['ldr r0,[r1]', 'bl  0x0800_1A2C', 'str r3,[sp,#4]', 'cmp r2,#0', 'bne 0x08000452']), 340, 50 + i * 20);
      }
      break;
    }
    case 'schema': g.fillStyle = '#fbfbf5'; g.fillRect(0, 0, W, H); disegnaSchema(g, W * 1.4, H, '#1d3f8a'); break;
    case 'pcb': {
      g.fillStyle = '#0d3b1f'; g.fillRect(0, 0, W, H); g.strokeStyle = '#d4a017'; g.lineWidth = 4;
      for (let i = 0; i < 26; i++) { g.beginPath(); let x = rnd(0, W), y = rnd(40, H); g.moveTo(x, y); for (let k = 0; k < 3; k++) { if (k % 2) x += rnd(-120, 120); else y += rnd(-80, 80); g.lineTo(x, y); } g.stroke(); }
      g.fillStyle = '#e5e7eb'; for (let i = 0; i < 40; i++) g.fillRect(rnd(0, W), rnd(40, H), 8, 8);
      g.fillStyle = '#111'; g.fillRect(W * 0.4, H * 0.35, 90, 90);
      break;
    }
    case 'grafico': case 'calore': {
      if (stile === 'calore') {
        for (let x = 0; x < W; x += 8) for (let y = 34; y < H; y += 8) {
          const v = Math.exp(-(((x - W * 0.55) / 120) ** 2) - (((y - H * 0.5) / 80) ** 2)) + Math.exp(-(((x - W * 0.3) / 70) ** 2) - (((y - H * 0.6) / 60) ** 2)) * 0.7;
          g.fillStyle = `hsl(${240 - Math.min(1, v) * 240},90%,${35 + v * 20}%)`; g.fillRect(x, y, 8, 8);
        }
      } else {
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.strokeStyle = '#e5e7eb'; g.lineWidth = 1;
        for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(40, 50 + i * 36); g.lineTo(W - 10, 50 + i * 36); g.stroke(); }
        [['#2563eb', 1], ['#dc2626', 1.7], ['#16a34a', 0.6]].forEach(([c, k]) => { g.strokeStyle = c; g.lineWidth = 2.5; g.beginPath(); for (let x = 40; x < W; x += 6) g.lineTo(x, H * 0.6 - Math.sin((x / 60) * k + t) * 70 * k / 1.7 - (x / W) * 60); g.stroke(); });
      }
      break;
    }
    case 'oscillo': {
      g.fillStyle = '#020a05'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(80,140,100,0.35)'; g.lineWidth = 1;
      for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo((i * W) / 10, 34); g.lineTo((i * W) / 10, H); g.stroke(); }
      for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(0, 34 + (i * (H - 34)) / 8); g.lineTo(W, 34 + (i * (H - 34)) / 8); g.stroke(); }
      [['#facc15', 0.3, (x) => (Math.sin(x / 18 + t * 4) > 0 ? -1 : 1)], ['#22d3ee', 0.62, (x) => Math.sin(x / 30 + t * 3)]].forEach(([c, y0, f]) => {
        g.strokeStyle = c; g.lineWidth = 2.5; g.beginPath(); for (let x = 0; x < W; x += 3) g.lineTo(x, H * y0 + f(x) * 40); g.stroke();
      });
      break;
    }
    case 'documento': {
      g.fillStyle = '#e5e7eb'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.fillRect(W * 0.18, 44, W * 0.64, H - 50);
      g.fillStyle = '#111827'; g.font = '700 18px "Segoe UI"'; g.fillText('Fascicolo tecnico – EN IEC 61800-3', W * 0.22, 80);
      g.fillStyle = '#9ca3af'; for (let i = 0; i < 14; i++) g.fillRect(W * 0.22, 100 + i * 20, W * (0.36 + Math.random() * 0.2), 7);
      break;
    }
    case 'cad': {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#5b6b7f'); gr.addColorStop(1, '#c8d0da'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#1f2937'; g.lineWidth = 2; const cx = W / 2, cy = H / 2 + 20, a = t * 0.4;
      const P = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([x, y, z]) => {
        const X = x * Math.cos(a) - z * Math.sin(a), Z = x * Math.sin(a) + z * Math.cos(a); return [cx + X * 110, cy + y * 70 * 0.8 + Z * 30];
      });
      [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([i, j]) => { g.beginPath(); g.moveTo(...P[i]); g.lineTo(...P[j]); g.stroke(); });
      g.fillStyle = 'rgba(56,189,248,0.25)'; g.beginPath(); g.moveTo(...P[4]); [5, 6, 7].forEach((i) => g.lineTo(...P[i])); g.fill();
      break;
    }
    case 'cablaggio': {
      g.fillStyle = '#f8fafc'; g.fillRect(0, 0, W, H);
      ['#dc2626', '#1d4ed8', '#16a34a', '#000', '#ca8a04', '#7c3aed'].forEach((c, i) => { g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 70 + i * 50); g.lineTo(260 + i * 20, 70 + i * 50); g.lineTo(260 + i * 20, 300); g.lineTo(W - 60, 300 + i * 12); g.stroke(); });
      g.fillStyle = '#64748b'; for (let i = 0; i < 12; i++) g.fillRect(W - 80, 290 + i * 10, 40, 6);
      break;
    }
    case 'ricerca': {
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#e5e7eb'; g.fillRect(30, 46, W - 60, 30);
      for (let i = 0; i < 6; i++) { g.fillStyle = '#1a0dab'; g.font = '17px Arial'; g.fillText(sceglie(['Datasheet DRV8353 – TI', 'Modbus Application Protocol', 'IPC-2152 current capacity', 'EN IEC 61800-3:2023', 'Infineon OptiMOS 5 80V']), 34, 110 + i * 52); g.fillStyle = '#9ca3af'; g.fillRect(34, 120 + i * 52, W - 120, 7); }
      break;
    }
    case 'test': {
      g.fillStyle = '#0f172a'; g.fillRect(0, 0, W, H); g.font = '15px Consolas';
      for (let i = 0; i < 16; i++) { const ok = (i + ((t * 2) | 0)) % 9 !== 0; g.fillStyle = ok ? '#4ade80' : '#f87171'; g.fillText(`${ok ? '✓' : '✗'} test_${['pwm', 'adc', 'eeprom', 'modbus', 'wdt', 'can'][i % 6]}_${i}`, 20, 54 + i * 22); }
      break;
    }
    default: g.fillStyle = '#111'; g.fillRect(0, 0, W, H);
  }
}

function sceglieColore(riga) {
  if (/^\s*(void|static|export|const|return|if|for)/.test(riga)) return '#c678dd';
  if (/[{}]/.test(riga) && riga.trim().length < 3) return '#abb2bf';
  if (/\(/.test(riga)) return '#61afef';
  return '#98c379';
}

// schermo di blocco per i PC liberi
export const SCHERMO_BLOCCO = texturaCanvas(512, 320, (g, W, H) => {
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#0b1224'); gr.addColorStop(1, '#1a1035'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,207,115,0.9)'; g.beginPath(); g.arc(W / 2, H / 2 - 18, 16, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8eeff'; g.font = '800 26px "Segoe UI"'; g.textAlign = 'center'; g.fillText('S I N A P S I', W / 2, H / 2 + 30);
});

// TV di reparto: chi lavora, gli ultimi passi, l'ultima busta
export function disegnaTV(g, W, H, rep, stato) {
  g.fillStyle = '#0a0f1c'; g.fillRect(0, 0, W, H);
  g.fillStyle = rep.colore; g.fillRect(0, 0, W, 8);
  g.fillStyle = '#fff'; g.font = '800 30px "Segoe UI"'; g.fillText(rep.nome.toUpperCase(), 28, 56);
  g.font = '600 18px Consolas'; g.fillStyle = stato.attivi ? '#4ade80' : '#64748b';
  g.fillText(stato.attivi ? `● ${stato.attivi} AL LAVORO` : '○ IN ATTESA', W - 230, 54);
  stato.righe.slice(-7).forEach((r, i) => {
    g.fillStyle = r.colore; g.font = `${r.tipo === 'pensiero' ? 'italic ' : ''}19px Consolas`;
    g.fillText(`${r.chi.slice(0, 14).padEnd(14)} ${r.icona} ${r.testo}`.slice(0, 64), 28, 104 + i * 34);
  });
  if (stato.busta) {
    g.fillStyle = stato.busta.colore; g.fillRect(28, H - 58, 6, 34);
    g.fillStyle = '#e2e8f0'; g.font = '600 18px "Segoe UI"'; g.fillText(`✉ ${stato.busta.testo}`.slice(0, 62), 46, H - 34);
  }
}
