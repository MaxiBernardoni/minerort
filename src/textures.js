// ============================================================
// textures.js - Texturas generadas por codigo (sin imagenes).
// Tiles de 32x32 en un atlas con borde de relleno (evita costuras al alejarse).
// Todas las texturas "tileables" usan ruido que se repite, asi no se notan los bordes.
// ============================================================

import * as THREE from 'three';
import { BLOCKS, ID } from './config.js';

const TILE = 32, PAD = 8, CELL = TILE + 2 * PAD, NTILES = 64;     // tiles 0-19: el juego; 20-62: para mods (tileNuevo); 63: "bloque desconocido"

const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = NTILES * CELL;
atlasCanvas.height = CELL;
const actx = atlasCanvas.getContext('2d');
const tileCanvases = [];   // cada tile suelto (para iconos)
const tileAvg = [];        // color promedio (para particulas)

// ---------- utilidades ----------
function hash2(x, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const rnd = (x, y, t) => hash2(x, y, t * 7919 + 13);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpC = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mulC = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const stretch = n => Math.max(0, Math.min(1, (n - 0.5) * 1.9 + 0.5));   // mas contraste

// Ruido de valor que se repite (tileable)
function tn2(x, y, cx, cy, seed, size = TILE) {
  const fx = x / size * cx, fy = y / size * cy;
  const xi = Math.floor(fx), yi = Math.floor(fy), xf = fx - xi, yf = fy - yi;
  const wx = i => ((i % cx) + cx) % cx, wy = i => ((i % cy) + cy) % cy;
  const a = hash2(wx(xi), wy(yi), seed), b = hash2(wx(xi + 1), wy(yi), seed);
  const c = hash2(wx(xi), wy(yi + 1), seed), d = hash2(wx(xi + 1), wy(yi + 1), seed);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const tn = (x, y, cells, seed, size = TILE) => tn2(x, y, cells, cells, seed, size);
const tfbm = (x, y, s, size = TILE) => tn(x, y, 4, s, size) * 0.5 + tn(x, y, 8, s + 1, size) * 0.3 + tn(x, y, 16, s + 2, size) * 0.2;

// Ruido celular (Worley): piedras, adoquines, agua. Devuelve distancia al punto mas cercano y al segundo.
function worley(x, y, n, seed, size = TILE) {
  const s = size / n, gx = x / s, gy = y / s, cx = Math.floor(gx), cy = Math.floor(gy);
  let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const ccx = cx + i, ccy = cy + j;
    const wx = ((ccx % n) + n) % n, wy = ((ccy % n) + n) % n;
    const px = ccx + 0.15 + 0.7 * hash2(wx, wy, seed), py = ccy + 0.15 + 0.7 * hash2(wx, wy, seed + 31);
    const d = Math.hypot(px - gx, py - gy);
    if (d < f1) { f2 = f1; f1 = d; id = hash2(wx, wy, seed + 77); } else if (d < f2) f2 = d;
  }
  return { f1, f2, id };
}

function paint(tile, fn) {
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(TILE, TILE);
  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const col = fn(x, y), a = col[3] === undefined ? 255 : col[3], i = (y * TILE + x) * 4;
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = a;
    if (a > 0) { sr += col[0]; sg += col[1]; sb += col[2]; n++; }
  }
  ctx.putImageData(img, 0, 0);
  tileCanvases[tile] = c;
  tileAvg[tile] = [sr / n / 255, sg / n / 255, sb / n / 255];
  // al atlas, repitiendo el tile alrededor (relleno)
  actx.save();
  actx.beginPath(); actx.rect(tile * CELL, 0, CELL, CELL); actx.clip();
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++)
    actx.drawImage(c, tile * CELL + PAD + ox * TILE, PAD + oy * TILE);
  actx.restore();
}

// UV de una esquina (ux,uy en 0..1) de un tile dentro del atlas
function tileUV(tile, ux, uy) {
  return [(tile * CELL + PAD + ux * TILE) / (NTILES * CELL), (PAD + uy * TILE) / CELL];
}

// ---------- colores base ----------
function grassColor(x, y, s) {
  let c = lerpC([58, 122, 34], [116, 182, 64], stretch(tfbm(x, y, s)));
  const r = rnd(x, y, s + 5);
  if (r > 0.93) c = mulC(c, 1.28); else if (r < 0.08) c = mulC(c, 0.7);
  return mulC(c, 0.9 + tn2(x, y, 24, 3, s + 9) * 0.2);           // hebras verticales
}
function dirtColor(x, y, s) {
  let c = lerpC([94, 64, 40], [138, 98, 66], stretch(tfbm(x, y, s)));
  if (tn(x, y, 9, s + 3) > 0.8) c = lerpC(c, [165, 140, 115], 0.55);   // piedritas
  const r = rnd(x, y, s + 6);
  if (r < 0.07) c = mulC(c, 0.72); else if (r > 0.95) c = mulC(c, 1.2);
  return c;
}
const BARK_DARK = [66, 46, 26], BARK_LIGHT = [132, 98, 60];

// ---------- tiles ----------
paint(0, (x, y) => grassColor(x, y, 10));                                         // cesped (arriba)
paint(1, (x, y) => {                                                              // cesped (lado)
  const depth = 7 + Math.floor(rnd(x, 0, 11) * 4);
  if (y < depth) return y >= depth - 2 ? mulC(grassColor(x, y, 12), 0.85) : grassColor(x, y, 12);
  return mulC(dirtColor(x, y, 13), y === depth ? 0.78 : 1);
});
paint(2, (x, y) => dirtColor(x, y, 20));                                          // tierra
function piedraColor(x, y) {
  let c = lerpC([102, 102, 106], [144, 144, 148], stretch(tfbm(x, y, 30)));
  if (Math.abs(tn(x, y, 5, 31) - 0.5) < 0.016 || Math.abs(tn(x, y, 9, 32) - 0.5) < 0.012) c = mulC(c, 0.68); // grietas
  const r = rnd(x, y, 33);
  if (r < 0.06) c = mulC(c, 0.82); else if (r > 0.95) c = mulC(c, 1.15);
  return c;
}
paint(3, piedraColor);                                                            // piedra
paint(4, (x, y) => {                                                              // madera (lado)
  const g = tn2(x, y, 12, 2, 40);
  let c = lerpC(BARK_DARK, BARK_LIGHT, g);
  if (g < 0.32) c = mulC(c, 0.75);
  return mulC(c, 0.92 + rnd(x, y, 41) * 0.16);
});
paint(5, (x, y) => {                                                              // madera (arriba)
  if (Math.min(x, y, TILE - 1 - x, TILE - 1 - y) < 3) return mulC(lerpC(BARK_DARK, [120, 88, 52], tn2(x, y, 12, 2, 40)), 0.95 + rnd(x, y, 42) * 0.1);
  const d = Math.hypot(x - 15.5, y - 15.5) + (tfbm(x, y, 43) - 0.5) * 3.5;
  let c = lerpC([176, 138, 84], [206, 170, 112], Math.sin(d * 1.15) * 0.5 + 0.5);   // anillos
  if (d < 2.5) c = mulC(c, 0.85);
  return mulC(c, 0.95 + rnd(x, y, 44) * 0.1);
});
paint(6, (x, y) => {                                                              // hojas (con huecos)
  const m = tn(x, y, 8, 50);
  const hole = m > 0.74 || rnd(x, y, 51) > 0.95;
  let c = lerpC([28, 88, 26], [82, 164, 54], stretch(tfbm(x, y, 52)));
  if (m > 0.64) c = mulC(c, 0.7);
  if (rnd(x, y, 53) > 0.9) c = mulC(c, 1.25);
  return [c[0], c[1], c[2], hole ? 0 : 255];
});
paint(7, (x, y) => {                                                              // arena
  let c = lerpC([198, 182, 130], [234, 220, 170], stretch(tfbm(x, y, 60)));
  const r = rnd(x, y, 61);
  if (r < 0.07) c = mulC(c, 0.86); else if (r > 0.94) c = mulC(c, 1.08);
  return c;
});
paint(8, (x, y) => {                                                              // tablones
  const row = y >> 3, ly = y % 8, joint = row % 2 ? 10 : 22;
  let c = lerpC([150, 110, 66], [190, 148, 92], rnd(row, 0, 81));
  c = mulC(c, (0.9 + rnd(0, y, 82) * 0.16) * (0.94 + tn2(x, y, 3, 32, 83 + row) * 0.12));   // vetas
  if (ly === 0) c = mulC(c, 0.6); else if (ly === 1) c = mulC(c, 1.1);
  if (x === joint) c = mulC(c, 0.6);
  if ((x === 4 || x === 27) && ly === 4) c = [70, 60, 55];                         // clavos
  return c;
});
paint(9, (x, y) => {                                                              // ladrillo
  const row = y >> 3, ly = y % 8, off = row % 2 ? 8 : 0, bx = (x + off) % 32, lx = bx % 16;
  if (ly === 0 || lx === 0) return lerpC([168, 163, 152], [196, 191, 181], rnd(x, y, 90));   // mortero
  let c = lerpC([148, 56, 42], [180, 84, 60], hash2(bx >> 4, row, 91));
  c = mulC(c, 0.88 + stretch(tfbm(x, y, 92)) * 0.2);
  if (rnd(x, y, 93) < 0.08) c = mulC(c, 0.8);
  if (ly === 1) c = mulC(c, 1.12); else if (ly === 7) c = mulC(c, 0.82);
  return c;
});
paint(10, (x, y) => {                                                             // adoquin
  const w = worley(x, y, 5, 100);
  let g = 84 + w.id * 70;
  g *= 0.82 + stretch(tfbm(x, y, 101)) * 0.3;
  g *= 1.1 - w.f1 * 0.3;
  if (w.f2 - w.f1 < 0.1) g *= 0.5;
  return [g, g, g + 4];
});
const tablon = (x, y) => mulC(lerpC([150, 110, 66], [190, 148, 92], rnd(y >> 3, 0, 81)), 0.92 + rnd(x, y, 120) * 0.14);   // color de madera de la mesa
paint(11, (x, y) => {                                                             // mesa de crafteo (arriba): marco y cuadricula de 3x3
  if (Math.min(x, y, TILE - 1 - x, TILE - 1 - y) < 3) return mulC(lerpC(BARK_DARK, [110, 78, 44], rnd(x, y, 121)), 0.95);
  const linea = x >= 4 && x <= 28 && y >= 4 && y <= 28 && ((x - 4) % 8 === 0 || (y - 4) % 8 === 0);
  return linea ? [70, 48, 28] : mulC(tablon(x, y), 0.82);
});
paint(12, (x, y) => {                                                             // mesa de crafteo (lados): tablones con una herramienta dibujada
  if (y < 5) return mulC(lerpC(BARK_DARK, [110, 78, 44], rnd(x, y, 122)), 0.95);   // el marco de arriba
  if (Math.abs((x - 6) - (26 - y) * 0.62) < 1.3 && y >= 10 && y <= 26) return [90, 62, 34];      // mango
  if (y >= 8 && y <= 11 && x >= 11 && x <= 24) return [128, 128, 132];                           // cabeza
  return tablon(x, y);
});

// ---------- Fase 3: minerales, nieve, abedul y cactus ----------
// Mineral: la piedra con manchas del color del mineral (celdas de ruido celular elegidas al azar)
function mineral(seed, oscuro, claro) {
  return (x, y) => {
    const w = worley(x, y, 4, seed);
    if (w.id > 0.4 && w.f1 < 0.2 + w.id * 0.1) {
      const t = rnd(x, y, seed + 3);
      let c = lerpC(oscuro, claro, t * 0.6 + (1 - w.f1 * 2.4) * 0.4);
      if (w.f1 > 0.26) c = mulC(c, 0.75);                                         // borde de la mancha
      return c;
    }
    return piedraColor(x, y);
  };
}
paint(13, mineral(140, [176, 118, 84], [230, 188, 156]));                         // mineral de hierro (manchas color hierro oxidado)
paint(14, mineral(150, [40, 188, 186], [190, 255, 250]));                         // mineral de diamante
paint(15, (x, y) => {                                                             // nieve
  let c = lerpC([226, 232, 242], [250, 252, 255], stretch(tfbm(x, y, 160)));
  const r = rnd(x, y, 161);
  if (r < 0.08) c = mulC(c, 0.92); else if (r > 0.96) c = [255, 255, 255];
  return c;
});
paint(16, (x, y) => {                                                             // abedul (lado): corteza blanca con marcas oscuras
  let c = lerpC([200, 196, 186], [236, 232, 222], tn2(x, y, 3, 8, 170));
  if (rnd(x >> 2, y >> 1, 171) > 0.84 && (x & 3) < 3 && (y & 1) === 0) c = [62, 58, 54];
  return mulC(c, 0.94 + rnd(x, y, 172) * 0.1);
});
paint(17, (x, y) => {                                                             // abedul (arriba)
  if (Math.min(x, y, TILE - 1 - x, TILE - 1 - y) < 3) return mulC([214, 210, 198], 0.92 + rnd(x, y, 173) * 0.12);
  const d = Math.hypot(x - 15.5, y - 15.5) + (tfbm(x, y, 174) - 0.5) * 3.5;
  let c = lerpC([196, 178, 128], [222, 206, 158], Math.sin(d * 1.15) * 0.5 + 0.5);
  if (d < 2.5) c = mulC(c, 0.85);
  return mulC(c, 0.95 + rnd(x, y, 175) * 0.1);
});
paint(18, (x, y) => {                                                             // cactus (lado): costillas verticales y espinas
  const costilla = x % 8;
  let c = lerpC([46, 110, 44], [86, 158, 64], tn2(x, y, 4, 12, 180));
  if (costilla === 0 || costilla === 7) c = mulC(c, 0.66);
  if (costilla === 0 && y % 6 === 2) c = [232, 236, 180];                          // espina
  return mulC(c, 0.93 + rnd(x, y, 181) * 0.12);
});
paint(19, (x, y) => {                                                             // cactus (arriba)
  const borde = Math.min(x, y, TILE - 1 - x, TILE - 1 - y);
  if (borde < 3) return mulC([40, 100, 40], 0.92 + rnd(x, y, 182) * 0.14);
  let c = lerpC([88, 160, 66], [116, 188, 84], rnd(x >> 2, y >> 2, 183));
  if (Math.abs(x - 15.5) < 2 || Math.abs(y - 15.5) < 2) c = mulC(c, 0.85);
  return c;
});

// ---------- sprites de objetos (los que NO son bloques: se dibujan planos, de 16x16) ----------
// Una letra por pixel, '.' = transparente. effects.js los convierte en un objeto plano con espesor.
const itemSprites = {};
function paintSprite(id, filas, paleta) {
  const N = 16, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  filas.forEach((fila, y) => [...fila.padEnd(N, '.')].forEach((ch, x) => {
    if (ch === '.') return;
    g.fillStyle = paleta[ch];
    g.fillRect(x, y, 1, 1);
  }));
  itemSprites[id] = c;
}
paintSprite(ID.MANZANA, [                                                         // manzana
  '................',
  '.......sd..gg...',
  '.......s..gggg..',
  '....ooo.s.ggG...',
  '..oorrrorrrro...',
  '.orrhhrrrrrrro..',
  '.orhhrrrrrrrro..',
  'orrhrrrrrrrrrro.',
  'orrrrrrrrrrrrro.',
  'orrrrrrrrrrrrdo.',
  'orrrrrrrrrrrddo.',
  '.orrrrrrrrrdddo.',
  '.orrrrrrrrrddo..',
  '..oorrrrrrrroo..',
  '...ooorroooo....',
], { o: '#6e0f12', r: '#cf2a2a', h: '#ff9c9c', d: '#962024', s: '#5a3a1e', g: '#54ad3b', G: '#2e7a24' });

// Palo y herramientas: se arman con pixeles sueltos y se les dibuja un contorno oscuro (como los de Minecraft)
function spriteDePixeles(id, pixeles) {
  const N = 16, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const color = (x, y) => pixeles[x + ',' + y];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const col = color(x, y);
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    else if (color(x - 1, y) || color(x + 1, y) || color(x, y - 1) || color(x, y + 1)) { g.fillStyle = '#1e140a'; g.fillRect(x, y, 1, 1); }
  }
  itemSprites[id] = c;
}
const MANGO = '#7a5428';
// Cabezas (pixeles x,y de la grilla de 16x16): 'principal' es el color del material y 'claro' el brillo
const CABEZAS = {
  pico: {
    principal: [[4, 4], [5, 3], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 3], [13, 4], [13, 5], [13, 6]],
    claro: [[5, 4], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [12, 4], [12, 5]],
  },
  // el hacha: una hoja que se abre hacia abajo y a la derecha del extremo del mango; el filo (lo mas lejos) es la parte clara
  hacha: {
    principal: [[9, 2], [10, 2], [11, 2], [9, 3], [10, 3], [11, 3], [12, 3], [10, 4], [11, 4], [12, 4], [13, 4], [11, 5], [12, 5], [13, 5], [14, 5], [12, 6], [13, 6], [14, 6], [13, 7]],
    claro: [[13, 4], [14, 5], [14, 6], [13, 7]],
  },
  pala: ovalo(),
};
// la pala: una paleta ovalada, alargada en la direccion del mango (hacia arriba y a la derecha)
function ovalo() {
  const principal = [], claro = [];
  for (let y = 0; y < 8; y++) for (let x = 8; x < 16; x++) {
    const u = ((x - 12) - (y - 3)) / Math.SQRT2, v = ((x - 12) + (y - 3)) / Math.SQRT2;   // u: a lo largo del mango, v: de costado
    if ((u / 3.4) ** 2 + (v / 2.1) ** 2 <= 1) (v < -0.4 ? claro : principal).push([x, y]);
  }
  return { principal, claro };
}
// Espadas: mango abajo a la izquierda, guarda cruzada y una hoja de dos pixeles de ancho hacia arriba a la derecha
function espada(id, material) {
  const p = {}, m = MATERIALES[material];
  [[1, 14], [2, 13], [3, 12]].forEach(([x, y]) => { p[x + ',' + y] = MANGO; });
  [[3, 10], [4, 11], [5, 12]].forEach(([x, y]) => { p[x + ',' + y] = '#8a6a2a'; });
  for (let i = 0; i < 9; i++) { p[(5 + i) + ',' + (10 - i)] = m.principal; p[(6 + i) + ',' + (10 - i)] = i > 5 ? m.claro : m.principal; p[(5 + i) + ',' + (9 - i)] = m.claro; }
  spriteDePixeles(id, p);
}
const MATERIALES = {
  madera: { principal: '#a67c45', claro: '#cfa66a' }, piedra: { principal: '#7e7e7e', claro: '#b4b4b4' },
  hierro: { principal: '#cdcdd4', claro: '#f6f6fa' }, diamante: { principal: '#2fcfc4', claro: '#b4fff8' },
};
function herramienta(id, tipo, material) {
  const p = {}, m = MATERIALES[material], cab = CABEZAS[tipo];
  for (let i = 0; i < 10; i++) p[(2 + i) + ',' + (13 - i)] = MANGO;                // el mango, en diagonal
  cab.principal.forEach(([x, y]) => { p[x + ',' + y] = m.principal; });
  cab.claro.forEach(([x, y]) => { p[x + ',' + y] = m.claro; });
  spriteDePixeles(id, p);
}
{
  const palo = {};
  for (let i = 0; i < 11; i++) palo[(2 + i) + ',' + (14 - i)] = MANGO;
  spriteDePixeles(ID.PALO, palo);
}
herramienta(ID.PICO_MADERA, 'pico', 'madera');   herramienta(ID.PICO_PIEDRA, 'pico', 'piedra');
herramienta(ID.HACHA_MADERA, 'hacha', 'madera'); herramienta(ID.HACHA_PIEDRA, 'hacha', 'piedra');
herramienta(ID.PALA_MADERA, 'pala', 'madera');   herramienta(ID.PALA_PIEDRA, 'pala', 'piedra');
herramienta(ID.PICO_HIERRO, 'pico', 'hierro');   herramienta(ID.PICO_DIAMANTE, 'pico', 'diamante');
herramienta(ID.HACHA_HIERRO, 'hacha', 'hierro'); herramienta(ID.HACHA_DIAMANTE, 'hacha', 'diamante');
herramienta(ID.PALA_HIERRO, 'pala', 'hierro');   herramienta(ID.PALA_DIAMANTE, 'pala', 'diamante');
espada(ID.ESPADA_MADERA, 'madera'); espada(ID.ESPADA_PIEDRA, 'piedra'); espada(ID.ESPADA_HIERRO, 'hierro'); espada(ID.ESPADA_DIAMANTE, 'diamante');
paintSprite(ID.CARNE, [                                                          // un muslo: carne con un hueso que sale en diagonal
  '................',
  '................',
  '....oooooo......',
  '...oRRRRRRo.....',
  '..oRRhhRRRRo....',
  '..oRhhRRRRRRo...',
  '..oRRRRRRRRRo...',
  '..oRRRRRrrRRo...',
  '...oRRRrrRRoWo..',
  '....oRRRRRoWWWo.',
  '.....ooooo.oWWWo',
  '............ooWo',
  '.............ooo',
], { o: '#5a1418', R: '#c84a52', r: '#a8343c', h: '#f0a0a4', W: '#f2ead8' });
paintSprite(ID.LINGOTE, [
  '................',
  '................',
  '................',
  '................',
  '....oooooooooo..',
  '...ohhhhhhhhhho.',
  '..ohhhhhhhhhhlo.',
  '.ooooooooooooloo',
  '.oLLLLLLLLLLldo.',
  '.oLLLLLLLLLLldo.',
  '.oLLLLLLLLLLldo.',
  '.ooooooooooooo..',
], { o: '#44444c', h: '#f4f4f8', L: '#d2d2da', l: '#a6a6b0', d: '#82828c' });
paintSprite(ID.DIAMANTE, [
  '................',
  '................',
  '....oooooooo....',
  '...ohhwhhmmmdo..',
  '..ohhhhmmmmmddo.',
  '.ooooooooooooooo',
  '.ohhhhmmmmmmmddo',
  '..ohhmmmmmmmddo.',
  '...ohmmmmmmddo..',
  '....ohmmmmddo...',
  '.....ohmmddo....',
  '......ohmdo.....',
  '.......odo......',
  '........o.......',
], { o: '#0c5a62', h: '#a4f6f0', m: '#38d6cc', d: '#1a9aa0', w: '#ffffff' });

// ---------- para mods: tiles y sprites nuevos en tiempo de ejecucion ----------
const TILE_DESCONOCIDO = NTILES - 1;
paint(TILE_DESCONOCIDO, (x, y) => (((x >> 3) + (y >> 3)) % 2 ? [20, 20, 20] : [210, 40, 210]));   // damero magenta y negro
let siguienteTile = 20;
// Dibuja un tile nuevo en el atlas (fn(x, y) -> [r, g, b] en una grilla de 32x32) y devuelve su indice
function tileNuevo(fn) {
  if (siguienteTile >= TILE_DESCONOCIDO) throw new Error('no quedan tiles libres en el atlas (maximo ' + (TILE_DESCONOCIDO - 20) + ' para mods)');
  const t = siguienteTile++;
  paint(t, fn);
  atlasTexture.needsUpdate = true;
  return t;
}
// Texturas listas para usar (devuelven la fn de tileNuevo)
const texturaRuido = (color, variacion = 0.18) => (x, y) => mulC(color, 1 - variacion + stretch(tfbm(x, y, 700)) * variacion * 2 + (rnd(x, y, 701) - 0.5) * variacion);
const texturaMineral = color => mineral(150 + Math.floor(hash2(color[0], color[1], color[2]) * 90), mulC(color, 0.7), lerpC(color, [255, 255, 255], 0.45));
// Sprite de objeto desconocido (un mod que falta): un signo de pregunta
function spriteDesconocido(id) {
  paintSprite(id, ['................', '................', '.....oooooo.....', '....oMMMMMMo....', '...oMMooooMMo...', '...oMMo..oMMo...', '.......oMMo.....', '......oMMo......', '.....oMMo.......', '.....oMMo.......', '................', '.....oMMo.......', '.....oMMo.......'], { o: '#201020', M: '#d028d0' });
}
// Sprite de una herramienta con los colores del mod: principal y claro son '#rrggbb'
function herramientaSprite(id, tipo, colores) {
  const p = {}, cab = CABEZAS[tipo];
  if (!cab && tipo !== 'espada') throw new Error('herramienta desconocida: ' + tipo);
  if (tipo === 'espada') { MATERIALES['mod' + id] = colores; espada(id, 'mod' + id); return; }
  for (let i = 0; i < 10; i++) p[(2 + i) + ',' + (13 - i)] = MANGO;
  cab.principal.forEach(([x, y]) => { p[x + ',' + y] = colores.principal; });
  cab.claro.forEach(([x, y]) => { p[x + ',' + y] = colores.claro; });
  spriteDePixeles(id, p);
}

const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
atlasTexture.magFilter = THREE.NearestFilter;
atlasTexture.minFilter = THREE.NearestMipmapLinearFilter;
atlasTexture.anisotropy = 4;

// ---------- agua (textura aparte, se repite y se desliza) ----------
const waterTexture = (() => {
  const S = 64, c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d'), img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const w = worley(x, y, 6, 70, S);
    let col = lerpC([26, 80, 176], [70, 150, 226], stretch(tfbm(x, y, 71, S)));
    col = lerpC(col, [200, 232, 255], (1 - smooth(0, 0.18, w.f2 - w.f1)) * 0.5);   // lineas de luz (caustica)
    const i = (y * S + x) * 4;
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  return t;
})();

// ---------- grietas al romper (10 etapas) ----------
const crackTextures = [];
for (let s = 0; s < 10; s++) {
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  for (let r = 0; r < 8; r++) {
    let x = 16 + (hash2(r, 1, 500) - 0.5) * 8, y = 16 + (hash2(r, 2, 500) - 0.5) * 8;
    let ang = hash2(r, 3, 500) * Math.PI * 2;
    const len = 2 + s * 3.4;
    for (let i = 0; i < len; i++) {
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
      ang += (hash2(r, i + 10, 501) - 0.5) * 1.0;
      x += Math.cos(ang); y += Math.sin(ang);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  crackTextures.push(t);
}

// ---------- icono para la barra y el inventario: cubo isometrico para los bloques, el sprite plano para los objetos ----------
function makeBlockIcon(id) {
  const S = 64, T = TILE, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  if (itemSprites[id]) {                                    // objeto plano: se ve el dibujo, no un cubo
    g.imageSmoothingEnabled = false;                        // pixeles nitidos
    g.drawImage(itemSprites[id], 8, 8, 48, 48);
    return c;
  }
  g.imageSmoothingEnabled = true;
  const [top, , side] = BLOCKS[id].tiles;
  g.setTransform(28 / T, 14 / T, -28 / T, 14 / T, 32, 4);  g.drawImage(tileCanvases[top], 0, 0);
  g.setTransform(28 / T, 14 / T, 0, 28 / T, 4, 18);        g.drawImage(tileCanvases[side], 0, 0);
  g.setTransform(28 / T, -14 / T, 0, 28 / T, 32, 32);      g.drawImage(tileCanvases[side], 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const poly = (pts, style) => { g.fillStyle = style; g.beginPath(); g.moveTo(...pts[0]); pts.slice(1).forEach(p => g.lineTo(...p)); g.closePath(); g.fill(); };
  poly([[4, 18], [32, 32], [32, 60], [4, 46]], 'rgba(0,0,0,0.25)');
  poly([[32, 32], [60, 18], [60, 46], [32, 60]], 'rgba(0,0,0,0.45)');
  return c;
}

export { hash2, lerp, smooth, tn, tileUV, tileAvg, atlasTexture, waterTexture, crackTextures, itemSprites, makeBlockIcon,
         tileNuevo, TILE_DESCONOCIDO, texturaRuido, texturaMineral, paintSprite, spriteDesconocido, herramientaSprite };
