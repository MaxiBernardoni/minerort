// ============================================================
// world.js - Terreno, chunks y generacion de mallas 3D.
//   1. Ruido para el terreno      (heightAt)
//   1b. Biomas, cuevas, minerales y cabañas (biomeAt, esCueva, cabanaEn)
//   2. Generacion de un chunk     (generateChunk) con agua, arboles, cuevas, minerales y cabañas
//   3. Acceso a bloques           (getBlock / setBlock)
//   4. Malla del chunk            (buildChunkMesh): sombreado AO, hojas con huecos, agua
//   5. Carga/descarga de chunks   (updateChunks)
// ============================================================

import * as THREE from 'three';
import { CONFIG, CS, H, ID, BLOCKS, WATER, LEAVES, isWater, alturaAgua } from './config.js';
import { hash2, tileUV, atlasTexture, waterTexture } from './textures.js';
import { scene, shadow } from './scene.js';

// ---------- 1. Ruido ----------
function valueNoise(x, z, s) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s);
  const c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, z, s, octaves = 4) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, z * freq, s + i * 101) * amp;
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

function heightAt(x, z) {
  const seed = CONFIG.seed;
  let b = (fbm(x / 110, z / 110, seed) - 0.5) * 1.5 + 0.5;
  b = Math.max(0, Math.min(1, b));
  const detail = fbm(x / 28, z / 28, seed + 50, 3);
  const h = 20 + Math.pow(b, 1.8) * 32 + detail * 6;
  return Math.min(Math.floor(h), H - 12);
}

// ---------- 1b. Biomas, cuevas y minerales ----------
const BIOMA = { LLANURA: 0, BOSQUE: 1, DESIERTO: 2, NEVADO: 3 };
const BIOMA_NOMBRE = ['Llanura', 'Bosque', 'Desierto', 'Nevado'];
// Frecuencia relativa de arboles (se multiplica por CONFIG.treeChance): el desierto da cactus y el nevado, pinos
const K_ARBOL = [0.35, 3, 0.7, 1];
const LINEA_NIEVE = 47;                    // por encima de esta altura todo es nieve (menos en el desierto)

// Temperatura baja = nevado, alta = desierto; en el medio la humedad separa bosque de llanura
function biomeAt(x, z) {
  const seed = CONFIG.seed;
  const t = fbm(x / 240, z / 240, seed + 300, 2);
  if (t < 0.385) return BIOMA.NEVADO;
  if (t > 0.65) return BIOMA.DESIERTO;
  return fbm(x / 200, z / 200, seed + 400, 2) > 0.5 ? BIOMA.BOSQUE : BIOMA.LLANURA;
}

// Ruido de valor en 3D (para las cuevas)
function noise3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const o0 = yi * 7919, o1 = o0 + 7919, p0 = yi * 104729, p1 = p0 + 104729;
  const a0 = hash2(xi + o0, zi + p0, s), a1 = hash2(xi + 1 + o0, zi + p0, s), a2 = hash2(xi + o0, zi + 1 + p0, s), a3 = hash2(xi + 1 + o0, zi + 1 + p0, s);
  const b0 = hash2(xi + o1, zi + p1, s), b1 = hash2(xi + 1 + o1, zi + p1, s), b2 = hash2(xi + o1, zi + 1 + p1, s), b3 = hash2(xi + 1 + o1, zi + 1 + p1, s);
  const a = (a0 + (a1 - a0) * u) + ((a2 + (a3 - a2) * u) - (a0 + (a1 - a0) * u)) * w;
  const b = (b0 + (b1 - b0) * u) + ((b2 + (b3 - b2) * u) - (b0 + (b1 - b0) * u)) * w;
  return a + (b - a) * v;
}

// Tuneles: donde se cruzan dos superficies de ruido 3D queda un tubo (el segundo ruido solo se mira si el primero ya paso)
const CUEVA_ANCHO = 0.045;
function esCueva(x, y, z) {
  const seed = CONFIG.seed;
  if (Math.abs(noise3(x / 24, y / 15, z / 24, seed + 1001) - 0.5) > CUEVA_ANCHO) return false;
  return Math.abs(noise3(x / 24, y / 15, z / 24, seed + 1002) - 0.5) < CUEVA_ANCHO * 1.2;
}
// Sumideros: pozos angostos que bajan desde la superficie hasta un tunel (la entrada a las cuevas)
const sumideroNoise = (x, z) => valueNoise(x / 6, z / 6, CONFIG.seed + 1100);
const esSumidero = (x, z) => sumideroNoise(x, z) > 0.86;

// Cabañas: una celda de 48x48 puede tener una, en un lugar llano y seco. Devuelve { x, z, y } (esquina y altura del piso) o null.
const CELDA_CABANA = 48;
function cabanaEn(gx, gz) {
  const seed = CONFIG.seed;
  if (hash2(gx, gz, seed + 900) > 0.3) return null;
  const x = gx * CELDA_CABANA + 4 + Math.floor(hash2(gx, gz, seed + 901) * 36);
  const z = gz * CELDA_CABANA + 4 + Math.floor(hash2(gx, gz, seed + 902) * 36);
  const alturas = [[0, 0], [6, 0], [0, 6], [6, 6], [3, 3]].map(([dx, dz]) => heightAt(x + dx, z + dz));
  const lo = Math.min(...alturas), hi = Math.max(...alturas);
  if (lo <= CONFIG.seaLevel + 2 || hi - lo > 3 || biomeAt(x + 3, z + 3) === BIOMA.NEVADO) return null;
  return { x, z, y: hi };
}

// ---------- 2. Generacion de chunks ----------
const chunks = new Map();
const chunkKey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
// Chunks modificados que se descargaron: se guardan aca para no perder lo construido al alejarse.
// Solo en memoria (se pierden al cerrar el juego). Base para el guardado en disco.
const savedChunks = new Map();

function generateChunk(cx, cz) {
  const saved = savedChunks.get(chunkKey(cx, cz));
  if (saved) return { cx, cz, data: saved.data, maxY: saved.maxY, mesh: null, waterMesh: null, meshed: false, modified: true };
  const data = new Uint8Array(CS * H * CS);
  const ch = { cx, cz, data, maxY: 0, mesh: null, waterMesh: null, meshed: false };
  const sea = CONFIG.seaLevel, seed = CONFIG.seed;

  for (let z = 0; z < CS; z++) {
    for (let x = 0; x < CS; x++) {
      const wx = cx * CS + x, wz = cz * CS + z;
      const h = heightAt(wx, wz);
      const bioma = biomeAt(wx, wz);
      const sandy = h <= sea + 1 || bioma === BIOMA.DESIERTO;
      const nieve = !sandy && (bioma === BIOMA.NEVADO || h >= LINEA_NIEVE);
      for (let y = 0; y <= h; y++) {
        let b;
        if (y === h) b = sandy ? 6 : nieve ? ID.NIEVE : 1;
        else if (y >= h - 3) b = sandy ? 6 : 2;
        else b = 3;
        data[y * 256 + z * 16 + x] = b;
      }
      for (let y = h + 1; y <= sea; y++) data[y * 256 + z * 16 + x] = WATER;   // lagos y mar
      ch.maxY = Math.max(ch.maxY, h, h < sea ? sea : 0);

      // cuevas: tuneles bajo la superficie (con 4 bloques de techo, asi no se vacian los lagos) y pozos de entrada
      for (let y = 3; y <= h - 4; y++) if (esCueva(wx, y, wz)) data[y * 256 + z * 16 + x] = 0;
      if (h > sea + 1 && esSumidero(wx, wz)) {
        let fondo = -1;                                                  // el tunel mas cercano, a 12 bloques o menos
        for (let y = h - 4; y >= h - 12 && y >= 3; y--) if (data[y * 256 + z * 16 + x] === 0) { fondo = y; break; }
        if (fondo > 0) for (let y = h; y > fondo; y--) data[y * 256 + z * 16 + x] = 0;
      }
    }
  }

  // Minerales: vetas pequenas en puntos al azar del chunk (siempre los mismos para cada chunk y semilla)
  let rs = (hash2(cx, cz, seed + 5000) * 4294967296) >>> 0;
  const azar = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
  const veta = (id, n, ymin, ymax) => {
    let x = Math.floor(azar() * CS), z = Math.floor(azar() * CS), y = ymin + Math.floor(azar() * (ymax - ymin + 1));
    for (let i = 0; i < n; i++) {
      if (x >= 0 && x < CS && z >= 0 && z < CS && y >= 1 && y < H && data[y * 256 + z * 16 + x] === 3) data[y * 256 + z * 16 + x] = id;
      const r = Math.floor(azar() * 6);
      if (r < 2) x += r ? 1 : -1; else if (r < 4) z += r === 3 ? 1 : -1; else y += r === 5 ? 1 : -1;
    }
  };
  for (let i = 0; i < 7; i++) veta(ID.MINERAL_HIERRO, 3 + Math.floor(azar() * 5), 4, 44);
  if (azar() < 0.4) veta(ID.MINERAL_DIAMANTE, 2 + Math.floor(azar() * 3), 3, 14);

  // Arboles: se miran las columnas vecinas (+-2) para que las copas crucen bordes de chunk.
  const set = (wx, y, wz, b, force) => {
    const lx = wx - cx * CS, lz = wz - cz * CS;
    if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || y < 0 || y >= H) return;
    const i = y * 256 + lz * 16 + lx;
    if (force || data[i] === 0) { data[i] = b; if (y > ch.maxY) ch.maxY = y; }
  };
  const capa = (wx, wz, y, r, esquinas) => {        // capa cuadrada de hojas de radio r (sin esquinas si esquinas = false)
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (!esquinas && r > 0 && Math.abs(dx) === r && Math.abs(dz) === r) continue;
      set(wx + dx, y, wz + dz, LEAVES, false);
    }
  };
  const maxChance = CONFIG.treeChance * Math.max(...K_ARBOL);
  for (let wz = cz * CS - 2; wz < cz * CS + CS + 2; wz++) {
    for (let wx = cx * CS - 2; wx < cx * CS + CS + 2; wx++) {
      const r = hash2(wx, wz, seed + 777);
      if (r > maxChance) continue;
      const bioma = biomeAt(wx, wz);
      if (r > CONFIG.treeChance * K_ARBOL[bioma]) continue;
      const gh = heightAt(wx, wz);
      if (gh <= sea + 1 || esSumidero(wx, wz)) continue;
      const alea = hash2(wx, wz, seed + 999);
      if (bioma === BIOMA.DESIERTO) {                                       // cactus
        const alto = 2 + Math.floor(alea * 3);
        for (let y = gh + 1; y <= gh + alto; y++) set(wx, y, wz, ID.CACTUS, true);
      } else if (bioma === BIOMA.NEVADO || gh >= LINEA_NIEVE) {             // pino: tronco alto y copa en cono
        const top = gh + 6 + Math.floor(alea * 3);
        for (let y = gh + 1; y <= top; y++) set(wx, y, wz, 4, true);
        [0, 1, 1, 2, 2, 2].forEach((rad, d) => { if (top + 1 - d >= gh + 3) capa(wx, wz, top + 1 - d, rad, rad === 1 && d !== 1); });
      } else {
        const tipo = hash2(wx, wz, seed + 1234);
        const abedul = tipo < (bioma === BIOMA.BOSQUE ? 0.3 : 0.12), grande = !abedul && bioma === BIOMA.BOSQUE && tipo > 0.82;
        const tronco = abedul ? ID.ABEDUL : 4;
        if (grande) {                                                       // roble grande
          const top = gh + 6 + Math.floor(alea * 2);
          for (let y = gh + 1; y <= top; y++) set(wx, y, wz, 4, true);
          [[top - 2, 3], [top - 1, 3], [top, 2], [top + 1, 2], [top + 2, 1], [top + 3, 1]].forEach(([y, rad]) => capa(wx, wz, y, rad, false));
        } else {
          const top = gh + (abedul ? 5 : 4) + Math.floor(alea * 2);
          for (let y = gh + 1; y <= top; y++) set(wx, y, wz, tronco, true);
          for (let y = top - 1; y <= top + 2; y++) {
            const rad = y <= top ? 2 : 1;
            capa(wx, wz, y, rad, !(rad === 2 || y === top + 2));
          }
        }
      }
    }
  }

  // Cabañas: piso y techo de tablones, paredes con esquinas de madera, puerta, ventanas y una mesa de crafteo adentro
  for (let gz = Math.floor((cz * CS - 8) / CELDA_CABANA); gz <= Math.floor((cz * CS + CS + 8) / CELDA_CABANA); gz++) {
    for (let gx = Math.floor((cx * CS - 8) / CELDA_CABANA); gx <= Math.floor((cx * CS + CS + 8) / CELDA_CABANA); gx++) {
      const cab = cabanaEn(gx, gz);
      if (!cab) continue;
      for (let dz = 0; dz < 7; dz++) for (let dx = 0; dx < 7; dx++) {
        const wx = cab.x + dx, wz = cab.z + dz, borde = dx === 0 || dx === 6 || dz === 0 || dz === 6, esquina = (dx === 0 || dx === 6) && (dz === 0 || dz === 6);
        for (let y = heightAt(wx, wz) + 1; y < cab.y; y++) set(wx, y, wz, ID.ADOQUIN, true);   // cimientos hasta el piso
        set(wx, cab.y, wz, ID.TABLONES, true);
        for (let y = cab.y + 1; y <= cab.y + 3; y++) set(wx, y, wz, borde ? (esquina ? ID.MADERA : ID.TABLONES) : 0, true);
        set(wx, cab.y + 4, wz, borde ? ID.ADOQUIN : ID.TABLONES, true);
        for (let y = cab.y + 5; y <= cab.y + 8; y++) set(wx, y, wz, 0, true);               // despeja arboles y relieve
      }
      for (const [dx, dy, dz] of [[3, 1, 6], [3, 2, 6], [0, 2, 3], [6, 2, 3], [3, 2, 0]]) set(cab.x + dx, cab.y + dy, cab.z + dz, 0, true);   // puerta y ventanas
      set(cab.x + 1, cab.y + 1, cab.z + 1, ID.MESA, true);
    }
  }
  return ch;
}

// ---------- 3. Acceso a bloques ----------
function getBlock(x, y, z) {
  if (y < 0) return 1;      // el fondo del mundo es solido
  if (y >= H) return 0;
  const ch = chunks.get(chunkKey(x >> 4, z >> 4));
  if (!ch) return 0;
  return ch.data[y * 256 + (z & 15) * 16 + (x & 15)];
}

// Agua por revisar (ver agua.js): las coordenadas de las celdas cuyo estado puede haber cambiado
const activeWater = new Set();
const waterKey = (x, y, z) => ((x + 1048576) * 2097152 + (z + 1048576)) * 64 + y;
const VEC7 = [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function activarAgua(x, y, z) {                     // solo si hay agua en la celda o pegada a ella
  if (!VEC7.some(([dx, dy, dz]) => isWater(getBlock(x + dx, y + dy, z + dz)))) return;
  for (const [dx, dy, dz] of VEC7) if (y + dy >= 0 && y + dy < H) activeWater.add(waterKey(x + dx, y + dy, z + dz));
}
const chunkLoaded = (x, z) => chunks.has(chunkKey(x >> 4, z >> 4));

// diferir = true: no rehace la malla ahora (la reconstruccion queda pendiente hasta rehacerMallas); lo usa el agua
const mallasPendientes = new Set();
function rehacerMallas() {
  for (const c of mallasPendientes) if (c.meshed && chunks.get(chunkKey(c.cx, c.cz)) === c) buildChunkMesh(c);
  mallasPendientes.clear();
}

function setBlock(x, y, z, b, diferir = false) {
  if (y < 0 || y >= H) return;
  const ch = chunks.get(chunkKey(x >> 4, z >> 4));
  if (!ch) return;
  const lx = x & 15, lz = z & 15;
  ch.data[y * 256 + lz * 16 + lx] = b;
  ch.modified = true;
  if (y > ch.maxY) ch.maxY = y;
  shadow.dirty = true;                     // redibujar sombras
  // reconstruir el chunk y los vecinos que comparten borde
  const xs = [ch.cx], zs = [ch.cz];
  if (lx === 0) xs.push(ch.cx - 1); if (lx === 15) xs.push(ch.cx + 1);
  if (lz === 0) zs.push(ch.cz - 1); if (lz === 15) zs.push(ch.cz + 1);
  for (const cx of xs) for (const cz of zs) {
    const c = chunks.get(chunkKey(cx, cz));
    if (c && c.meshed) { if (diferir) mallasPendientes.add(c); else buildChunkMesh(c); }
  }
  activarAgua(x, y, z);
}

// ---------- 4. Malla ----------
// Cada cara: normal, 4 vertices (antihorario visto desde afuera) y que tile usar (0 arriba, 1 abajo, 2 lado)
const FACES = [
  { n: [1, 0, 0],  v: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], t: 2 },
  { n: [-1, 0, 0], v: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], t: 2 },
  { n: [0, 1, 0],  v: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], t: 0 },
  { n: [0, -1, 0], v: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], t: 1 },
  { n: [0, 0, 1],  v: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], t: 2 },
  { n: [0, 0, -1], v: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], t: 2 },
];
// Por vertice: las 2 celdas laterales y la esquina que oscurecen ese vertice (ambient occlusion)
FACES.forEach(F => {
  const a = F.n.findIndex(c => c !== 0);
  const [t1, t2] = [0, 1, 2].filter(i => i !== a);
  F.ao = F.v.map(v => {
    const s1 = [0, 0, 0], s2 = [0, 0, 0];
    s1[t1] = v[t1] * 2 - 1; s2[t2] = v[t2] * 2 - 1;
    return { s1, s2 };
  });
});
const AO_LEVELS = [0.5, 0.7, 0.86, 1.0];
const QUV = [[0, 0], [1, 0], [1, 1], [0, 1]];

// Uniform de tiempo para el viento en las hojas
const windUniform = { value: 0 };
const chunkMaterial = new THREE.MeshLambertMaterial({ map: atlasTexture, vertexColors: true, alphaTest: 0.5 });
chunkMaterial.onBeforeCompile = shader => {
  shader.uniforms.uWindTime = windUniform;
  shader.vertexShader = 'attribute float sway;\nuniform float uWindTime;\n' + shader.vertexShader.replace(
    '#include <begin_vertex>',
    `vec3 transformed = vec3( position );
     vec4 wp = modelMatrix * vec4( position, 1.0 );
     float ph = uWindTime * 1.6 + wp.x * 0.6 + wp.z * 0.45 + wp.y * 0.3;
     transformed.x += sin( ph ) * 0.05 * sway;
     transformed.z += cos( ph * 0.9 ) * 0.05 * sway;
     transformed.y += sin( ph * 1.3 ) * 0.02 * sway;`
  );
};

const waterMaterial = new THREE.MeshBasicMaterial({
  map: waterTexture, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false,
});

function disposeChunkMeshes(ch) {
  for (const k of ['mesh', 'waterMesh']) {
    if (ch[k]) { scene.remove(ch[k]); ch[k].geometry.dispose(); ch[k] = null; }
  }
}

// --- Armado rapido de mallas ---
// Se copia el chunk + 1 bloque de borde de los vecinos a un arreglo plano ("pad", 18 x 18 x (H+2)).
// Asi cada consulta de vecino es una suma de indices, sin buscar en el Map de chunks.
const PW = CS + 2, PL = PW * PW;
const pad = new Uint8Array(PL * (H + 2));
const OPAQUE = new Uint8Array(256);                    // 1 = tapa las caras vecinas
const IS_WATER = new Uint8Array(256);                  // 1 = agua (fuente o fluyendo)
for (const k of Object.keys(BLOCKS)) { const b = +k; IS_WATER[b] = isWater(b) ? 1 : 0; OPAQUE[b] = (b === LEAVES || IS_WATER[b]) ? 0 : 1; }   // todos los bloques tapan, menos hojas y agua
// Luz del cielo: bajo el techo (el bloque opaco mas alto de la columna) oscurece CONFIG.luzPorBloque por bloque, hasta CONFIG.luzMinima. Es lo que hace oscuras las cuevas.
const LUZ = new Float32Array(80);
for (let d = 0; d < 80; d++) LUZ[d] = d < 1 ? 1 : Math.max(CONFIG.luzMinima, 1 - CONFIG.luzPorBloque * d);
const skyY = new Int16Array(PW * PW);                  // por columna del pad: nivel (del pad) del bloque opaco mas alto
const FACE_OFF = FACES.map(F => F.n[0] + F.n[2] * PW + F.n[1] * PL);
const FACE_AO = FACES.map(F => F.ao.map(({ s1, s2 }) => {
  const a = s1[0] + s1[2] * PW + s1[1] * PL, b = s2[0] + s2[2] * PW + s2[1] * PL;
  return { a, b, c: a + b };
}));
const tileUVCache = [];
function tileUVs(tile) {
  return tileUVCache[tile] || (tileUVCache[tile] = new Float32Array(QUV.flatMap(q => tileUV(tile, q[0], q[1]))));
}

function fillPad(ch) {
  let top = ch.maxY;
  for (let nz = -1; nz <= 1; nz++) for (let nx = -1; nx <= 1; nx++) { const nc = chunks.get(chunkKey(ch.cx + nx, ch.cz + nz)); if (nc && nc.maxY > top) top = nc.maxY; }
  top = Math.min(H - 1, top + 1);
  pad.fill(0);
  pad.fill(1, 0, PL);                                  // capa y=-1: el fondo del mundo es solido
  for (let nz = -1; nz <= 1; nz++) {
    for (let nx = -1; nx <= 1; nx++) {
      const nc = (nx || nz) ? chunks.get(chunkKey(ch.cx + nx, ch.cz + nz)) : ch;
      if (!nc) continue;
      const d = nc.data;
      const lx0 = nx === 0 ? 0 : nx < 0 ? 15 : 0, lx1 = nx === 0 ? 15 : lx0;
      const lz0 = nz === 0 ? 0 : nz < 0 ? 15 : 0, lz1 = nz === 0 ? 15 : lz0;
      for (let y = 0; y <= top; y++) {
        for (let lz = lz0; lz <= lz1; lz++) {
          const src = y * 256 + lz * 16, dst = (y + 1) * PL + (lz + 1 + nz * 16) * PW + 1 + nx * 16;
          for (let lx = lx0; lx <= lx1; lx++) pad[dst + lx] = d[src + lx];
        }
      }
    }
  }
  for (let col = 0; col < PL; col++) {                 // el techo de cada columna: de arriba hacia abajo hasta el primer bloque opaco
    let y = top + 1;
    while (y > 0 && !OPAQUE[pad[y * PL + col]]) y--;
    skyY[col] = y;
  }
}

// Buffers reutilizables (crecen si hace falta)
let cap = 65536;
let bP = new Float32Array(cap * 3), bN = new Float32Array(cap * 3), bC = new Float32Array(cap * 3);
let bU = new Float32Array(cap * 2), bS = new Float32Array(cap), bI = new Uint32Array(cap * 3 / 2);
function growBuffers() {
  cap *= 2;
  const g = (A, n) => { const B = new A.constructor(n); B.set(A); return B; };
  bP = g(bP, cap * 3); bN = g(bN, cap * 3); bC = g(bC, cap * 3);
  bU = g(bU, cap * 2); bS = g(bS, cap); bI = g(bI, cap * 3 / 2);
}
let wcap = 16384;
let wP = new Float32Array(wcap * 3), wC = new Float32Array(wcap * 3), wU = new Float32Array(wcap * 2), wI = new Uint32Array(wcap * 3 / 2);
function growWater() {
  wcap *= 2;
  const g = (A, n) => { const B = new A.constructor(n); B.set(A); return B; };
  wP = g(wP, wcap * 3); wC = g(wC, wcap * 3); wU = g(wU, wcap * 2); wI = g(wI, wcap * 3 / 2);
}

// Oclusion ambiental de un vertice: 0 (muy oscuro) .. 3 (sin sombra)
function aoLevel(q, A) {
  const a = OPAQUE[pad[q + A.a]], b = OPAQUE[pad[q + A.b]], c = OPAQUE[pad[q + A.c]];
  return (a && b) ? 0 : 3 - (a + b + c);
}

function buildChunkMesh(ch) {
  fillPad(ch);
  const x0 = ch.cx * CS, z0 = ch.cz * CS;
  const fancy = CONFIG.fancyLeaves;
  let vi = 0, ni = 0, wvi = 0, wni = 0;

  for (let y = 0; y <= ch.maxY; y++) {
    for (let z = 0; z < CS; z++) {
      for (let x = 0; x < CS; x++) {
        const p = (y + 1) * PL + (z + 1) * PW + x + 1;
        const b = pad[p];
        if (!b) continue;

        if (IS_WATER[b]) {                         // ----- agua: caras contra aire u hojas, y la parte que sobresale de un vecino de agua mas baja
          const topY = IS_WATER[pad[p + PL]] ? 1 : alturaAgua(b);
          const wx = x0 + x, wz = z0 + z;
          const dl = skyY[p % PL] - ((p / PL) | 0), lt = dl < 1 ? 1 : LUZ[dl > 79 ? 79 : dl];
          for (let f = 0; f < 6; f++) {
            const nb = pad[p + FACE_OFF[f]];
            const F = FACES[f];
            let y0 = 0;
            if (IS_WATER[nb]) {
              if (F.n[1] !== 0) continue;                                       // arriba o abajo hay mas agua
              const ntop = IS_WATER[pad[p + FACE_OFF[f] + PL]] ? 1 : alturaAgua(nb);
              if (ntop >= topY - 0.001) continue;                               // el vecino es igual de alto o mas
              y0 = ntop;
            } else if (nb !== 0 && nb !== LEAVES) continue;
            if (wvi + 4 > wcap) growWater();
            const br = (F.n[1] === 1 ? 1 : F.n[1] === -1 ? 0.6 : 0.8) * lt;
            for (let i = 0; i < 4; i++) {
              const v = F.v[i], vy = v[1] === 1 ? topY : y0, k = wvi + i;
              wP[k * 3] = x + v[0]; wP[k * 3 + 1] = y + vy; wP[k * 3 + 2] = z + v[2];
              wC[k * 3] = wC[k * 3 + 1] = wC[k * 3 + 2] = br;
              if (F.n[1] !== 0) { wU[k * 2] = wx + v[0]; wU[k * 2 + 1] = wz + v[2]; }
              else if (F.n[0] !== 0) { wU[k * 2] = wz + v[2]; wU[k * 2 + 1] = y + vy; }
              else { wU[k * 2] = wx + v[0]; wU[k * 2 + 1] = y + vy; }
            }
            wI[wni++] = wvi; wI[wni++] = wvi + 1; wI[wni++] = wvi + 2;
            wI[wni++] = wvi; wI[wni++] = wvi + 2; wI[wni++] = wvi + 3;
            wvi += 4;
          }
          continue;
        }

        const leaf = b === LEAVES, tiles = BLOCKS[b].tiles;
        for (let f = 0; f < 6; f++) {
          const q = p + FACE_OFF[f], nb = pad[q];
          // Las hojas muestran sus caras contra todo lo no opaco; el resto solo contra aire/hojas/agua
          if (leaf) { if (OPAQUE[nb] || (!fancy && nb === LEAVES)) continue; }
          else if (!(nb === 0 || nb === LEAVES || IS_WATER[nb])) continue;

          if (vi + 4 > cap) growBuffers();
          const F = FACES[f], A = FACE_AO[f], uv = tileUVs(tiles[F.t]);
          const ao0 = aoLevel(q, A[0]), ao1 = aoLevel(q, A[1]), ao2 = aoLevel(q, A[2]), ao3 = aoLevel(q, A[3]);
          const ao = [ao0, ao1, ao2, ao3];
          const dl = skyY[q % PL] - ((q / PL) | 0), lt = dl < 1 ? 1 : LUZ[dl > 79 ? 79 : dl];   // luz del cielo en la celda que mira la cara
          for (let i = 0; i < 4; i++) {
            const v = F.v[i], k = vi + i, br = AO_LEVELS[ao[i]] * lt;
            bP[k * 3] = x + v[0]; bP[k * 3 + 1] = y + v[1]; bP[k * 3 + 2] = z + v[2];
            bN[k * 3] = F.n[0]; bN[k * 3 + 1] = F.n[1]; bN[k * 3 + 2] = F.n[2];
            bC[k * 3] = bC[k * 3 + 1] = bC[k * 3 + 2] = br;
            bU[k * 2] = uv[i * 2]; bU[k * 2 + 1] = uv[i * 2 + 1];
            bS[k] = leaf ? 1 : 0;
          }
          if (ao0 + ao2 > ao1 + ao3) { bI[ni++] = vi; bI[ni++] = vi + 1; bI[ni++] = vi + 2; bI[ni++] = vi; bI[ni++] = vi + 2; bI[ni++] = vi + 3; }
          else { bI[ni++] = vi + 1; bI[ni++] = vi + 2; bI[ni++] = vi + 3; bI[ni++] = vi + 1; bI[ni++] = vi + 3; bI[ni++] = vi; }
          vi += 4;
        }
      }
    }
  }

  disposeChunkMeshes(ch);
  ch.meshed = true;

  if (vi) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(bP.slice(0, vi * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(bN.slice(0, vi * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(bC.slice(0, vi * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(bU.slice(0, vi * 2), 2));
    g.setAttribute('sway', new THREE.BufferAttribute(bS.slice(0, vi), 1));
    g.setIndex(new THREE.BufferAttribute(bI.slice(0, ni), 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, chunkMaterial);
    mesh.position.set(x0, 0, z0);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();      // los chunks no se mueven
    scene.add(mesh);
    ch.mesh = mesh;
  }
  if (wvi) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(wP.slice(0, wvi * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(wC.slice(0, wvi * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(wU.slice(0, wvi * 2), 2));
    g.setIndex(new THREE.BufferAttribute(wI.slice(0, wni), 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, waterMaterial);
    mesh.position.set(x0, 0, z0);
    mesh.renderOrder = 1;
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    scene.add(mesh);
    ch.waterMesh = mesh;
  }
}

// ---------- 5. Carga / descarga ----------
function makeOffsets(r) {
  const o = [];
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) o.push({ dx, dz, d: dx * dx + dz * dz });
  return o.sort((a, b) => a.d - b.d);
}
let genOffsets, meshOffsets, lastPCX = null, lastPCZ = null;

// Genera datos y mallas de chunks hasta agotar el presupuesto (cantidad o milisegundos por frame)
function updateChunks(px, pz, genBudget, meshBudget, msBudget = 4) {
  const R = CONFIG.renderDistance;
  if (!genOffsets) {
    genOffsets = makeOffsets(R + 1);
    meshOffsets = makeOffsets(R);
    lastPCX = null;
  }
  const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);

  if (pcx !== lastPCX || pcz !== lastPCZ) {          // descargar chunks lejanos
    lastPCX = pcx; lastPCZ = pcz;
    for (const [k, ch] of chunks) {
      if (Math.max(Math.abs(ch.cx - pcx), Math.abs(ch.cz - pcz)) > R + 2) {
        disposeChunkMeshes(ch);
        if (ch.modified) savedChunks.set(k, ch);
        chunks.delete(k);
      }
    }
  }

  const t0 = performance.now();
  let g = 0, m = 0;
  for (const o of genOffsets) {                       // generar datos (radio R+1)
    if (g >= genBudget || (g > 0 && performance.now() - t0 > msBudget)) break;
    const cx = pcx + o.dx, cz = pcz + o.dz, k = chunkKey(cx, cz);
    if (!chunks.has(k)) { chunks.set(k, generateChunk(cx, cz)); g++; }
  }
  for (const o of meshOffsets) {                      // mallas (radio R, con vecinos ya generados)
    if (m >= meshBudget || (m > 0 && performance.now() - t0 > msBudget)) break;
    const ch = chunks.get(chunkKey(pcx + o.dx, pcz + o.dz));
    if (!ch || ch.meshed) continue;
    let ready = true;
    for (let dx = -1; dx <= 1 && ready; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!chunks.has(chunkKey(ch.cx + dx, ch.cz + dz))) { ready = false; break; }
    }
    if (ready) { buildChunkMesh(ch); m++; }
  }
}

// Fuerza a recalcular los radios de carga (lo usa quality.js al cambiar la distancia de vision)
function resetLoadRadius() { genOffsets = null; }

export { chunks, chunkKey, savedChunks, generateChunk, heightAt, biomeAt, BIOMA, BIOMA_NOMBRE, esCueva, cabanaEn, getBlock, setBlock, rehacerMallas, activeWater, waterKey, chunkLoaded,
         updateChunks, resetLoadRadius, FACES, QUV, waterMaterial, windUniform };
