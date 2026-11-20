// ============================================================
// world.js - Terreno, chunks y generacion de mallas 3D.
//   1. Ruido para el terreno      (heightAt)
//   2. Generacion de un chunk     (generateChunk) con agua y arboles
//   3. Acceso a bloques           (getBlock / setBlock)
//   4. Malla del chunk            (buildChunkMesh): sombreado AO, hojas con huecos, agua
//   5. Carga/descarga de chunks   (updateChunks)
// ============================================================

import * as THREE from 'three';
import { CONFIG, CS, H, BLOCKS, WATER, LEAVES } from './config.js';
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
  const sea = CONFIG.seaLevel;

  for (let z = 0; z < CS; z++) {
    for (let x = 0; x < CS; x++) {
      const h = heightAt(cx * CS + x, cz * CS + z);
      const sandy = h <= sea + 1;
      for (let y = 0; y <= h; y++) {
        let b;
        if (y === h) b = sandy ? 6 : 1;
        else if (y >= h - 3) b = sandy ? 6 : 2;
        else b = 3;
        data[y * 256 + z * 16 + x] = b;
      }
      for (let y = h + 1; y <= sea; y++) data[y * 256 + z * 16 + x] = WATER;   // lagos y mar
      ch.maxY = Math.max(ch.maxY, h, h < sea ? sea : 0);
    }
  }

  // Arboles: se miran las columnas vecinas (+-2) para que las copas crucen bordes de chunk.
  const set = (wx, y, wz, b, force) => {
    const lx = wx - cx * CS, lz = wz - cz * CS;
    if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || y < 0 || y >= H) return;
    const i = y * 256 + lz * 16 + lx;
    if (force || data[i] === 0) { data[i] = b; if (y > ch.maxY) ch.maxY = y; }
  };
  for (let wz = cz * CS - 2; wz < cz * CS + CS + 2; wz++) {
    for (let wx = cx * CS - 2; wx < cx * CS + CS + 2; wx++) {
      if (hash2(wx, wz, CONFIG.seed + 777) > CONFIG.treeChance) continue;
      const gh = heightAt(wx, wz);
      if (gh <= sea + 1) continue;
      const top = gh + 4 + Math.floor(hash2(wx, wz, CONFIG.seed + 999) * 2);
      for (let y = gh + 1; y <= top; y++) set(wx, y, wz, 4, true);
      for (let y = top - 1; y <= top + 2; y++) {
        const r = y <= top ? 2 : 1;
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (dx === 0 && dz === 0 && y <= top) continue;
            if (Math.abs(dx) === r && Math.abs(dz) === r && (r === 2 || y === top + 2)) continue;
            set(wx + dx, y, wz + dz, LEAVES, false);
          }
        }
      }
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

function setBlock(x, y, z, b) {
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
    if (c && c.meshed) buildChunkMesh(c);
  }
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
for (const k of Object.keys(BLOCKS)) { const b = +k; OPAQUE[b] = (b === LEAVES || b === WATER) ? 0 : 1; }   // todos los bloques tapan, menos hojas y agua
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
  const top = Math.min(H - 1, ch.maxY + 1);
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

        if (b === WATER) {                         // ----- agua: solo caras contra aire u hojas
          const topY = pad[p + PL] === WATER ? 1 : 0.88;
          const wx = x0 + x, wz = z0 + z;
          for (let f = 0; f < 6; f++) {
            const nb = pad[p + FACE_OFF[f]];
            if (nb !== 0 && nb !== LEAVES) continue;
            if (wvi + 4 > wcap) growWater();
            const F = FACES[f];
            const br = F.n[1] === 1 ? 1 : F.n[1] === -1 ? 0.6 : 0.8;
            for (let i = 0; i < 4; i++) {
              const v = F.v[i], vy = v[1] === 1 ? topY : 0, k = wvi + i;
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
          else if (!(nb === 0 || nb === LEAVES || nb === WATER)) continue;

          if (vi + 4 > cap) growBuffers();
          const F = FACES[f], A = FACE_AO[f], uv = tileUVs(tiles[F.t]);
          const ao0 = aoLevel(q, A[0]), ao1 = aoLevel(q, A[1]), ao2 = aoLevel(q, A[2]), ao3 = aoLevel(q, A[3]);
          const ao = [ao0, ao1, ao2, ao3];
          for (let i = 0; i < 4; i++) {
            const v = F.v[i], k = vi + i, br = AO_LEVELS[ao[i]];
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

export { chunks, chunkKey, savedChunks, heightAt, getBlock, setBlock, updateChunks, resetLoadRadius, FACES, QUV, waterMaterial, windUniform };
