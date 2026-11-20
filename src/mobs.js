// ============================================================
// mobs.js - Criaturas: cerdo y vaca (pasivos) y zombi (hostil).
//   1. Modelos           cajas con color por vertice (como el jugador), unidas en pocas mallas: cuerpo + patas
//   2. Mobs y su IA      caminar al azar, huir de lo que los golpea, perseguir y golpear al jugador
//   3. Aparicion         cerca del jugador hasta CONFIG.maxMobs; los zombis solo de noche y se queman de dia
//   4. Combate           apuntarMob (rayo contra las cajas), golpear (dano, empujon y botin), matar
// Usa la fisica compartida de fisica.js. Los mobs NO se guardan en la partida: al abrirla aparecen otros.
// ============================================================

import * as THREE from 'three';
import { CONFIG, ID, H, LEAVES, isWater, isSolidB } from './config.js';
import { scene } from './scene.js';
import { player } from './player.js';
import { getBlock, heightAt, chunkLoaded } from './world.js';
import { moverEje } from './fisica.js';
import { daylight } from './sky.js';
import { danar } from './salud.js';
import { spawnDrop, creative } from './inventory.js';
import { pixelBox } from './effects.js';
import { hash2 } from './textures.js';
import { emit } from './eventos.js';

// ---------- 1. Modelos ----------
// Todos miran hacia -Z (como el jugador). Un modelo es { cuerpo: geometria unida, patas: [{x, y, z, geo}], brazos: [...] }.
const seg = (w, h, d) => [Math.max(1, Math.round(w / 0.075)), Math.max(1, Math.round(h / 0.075)), Math.max(1, Math.round(d / 0.075))];
const caja = (w, h, d, cx, cy, cz, colorAt) => pixelBox(w, h, d, seg(w, h, d), colorAt, false, [cx, cy, cz]);

function unir(geos) {                                   // junta varias geometrias (con posicion, normal, color e indice) en una
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3); col.set(g.attributes.color.array, ov * 3);
    for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + ov;
    ov += g.attributes.position.count; oi += g.index.count;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  r.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  r.setAttribute('color', new THREE.BufferAttribute(col, 3));
  r.setIndex(new THREE.BufferAttribute(idx, 1));
  return r;
}
const mezcla = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const ruido = (x, y, z, s) => hash2(Math.round(x * 14), Math.round(y * 14) + Math.round(z * 14) * 37, s);   // "pixeles" de ~7 cm

function modeloCerdo() {
  const ROSA = [0.95, 0.62, 0.66], HOCICO = [0.99, 0.74, 0.76], OJO = [0.1, 0.07, 0.09];
  const tono = (c, x, y, z) => mezcla(c, [c[0] * 0.88, c[1] * 0.88, c[2] * 0.88], ruido(x, y, z, 1) * 0.8);
  const cuerpo = unir([
    caja(0.5, 0.46, 0.8, 0, 0.53, 0.05, (x, y, z) => tono(ROSA, x, y, z)),
    caja(0.4, 0.38, 0.36, 0, 0.62, -0.5, (x, y, z) => (z < -0.15 && Math.abs(Math.abs(x) - 0.1) < 0.05 && y > 0 && y < 0.09 ? OJO : tono(ROSA, x, y, z))),
    caja(0.2, 0.14, 0.1, 0, 0.56, -0.73, (x, y, z) => (z < -0.03 && Math.abs(Math.abs(x) - 0.05) < 0.03 && Math.abs(y) < 0.03 ? [0.45, 0.25, 0.28] : HOCICO)),
  ]);
  const pata = caja(0.15, 0.3, 0.15, 0, -0.15, 0, (x, y, z) => (y < -0.25 ? [0.62, 0.38, 0.4] : tono(ROSA, x, y, z)));
  return { cuerpo, patas: [[-0.14, 0.3, -0.2], [0.14, 0.3, -0.2], [-0.14, 0.3, 0.28], [0.14, 0.3, 0.28]].map(([x, y, z]) => ({ x, y, z, geo: pata })), brazos: [] };
}

function modeloVaca() {
  const BLANCO = [0.93, 0.92, 0.89], NEGRO = [0.13, 0.12, 0.12], OJO = [0.1, 0.08, 0.08];
  const manchas = (x, y, z, s) => (ruido(x * 0.7, y * 0.7, z * 0.7, s) > 0.66 ? NEGRO : mezcla(BLANCO, [0.82, 0.8, 0.76], ruido(x, y, z, s + 1) * 0.6));
  const cuerpo = unir([
    caja(0.6, 0.62, 1.0, 0, 0.81, 0.05, (x, y, z) => manchas(x, y, z, 11)),
    caja(0.42, 0.42, 0.4, 0, 1.05, -0.68, (x, y, z) => (z < -0.17 && Math.abs(Math.abs(x) - 0.12) < 0.05 && y > 0.02 && y < 0.1 ? OJO : y < -0.1 && z < -0.12 ? [0.84, 0.64, 0.62] : manchas(x, y, z, 12))),
    caja(0.06, 0.14, 0.06, -0.24, 1.32, -0.62, () => [0.86, 0.82, 0.7]),
    caja(0.06, 0.14, 0.06, 0.24, 1.32, -0.62, () => [0.86, 0.82, 0.7]),
  ]);
  const pata = caja(0.18, 0.5, 0.18, 0, -0.25, 0, (x, y, z) => (y < -0.42 ? [0.2, 0.17, 0.16] : manchas(x, y, z, 13)));
  return { cuerpo, patas: [[-0.2, 0.5, -0.36], [0.2, 0.5, -0.36], [-0.2, 0.5, 0.42], [0.2, 0.5, 0.42]].map(([x, y, z]) => ({ x, y, z, geo: pata })), brazos: [] };
}

function modeloZombi() {
  const PIEL = [0.52, 0.64, 0.44], ROPA = [0.47, 0.34, 0.22], PANTALON = [0.3, 0.27, 0.3], OJO = [0.85, 0.12, 0.1];
  const rota = (c, x, y, z, s) => (ruido(x, y, z, s) > 0.82 ? mezcla(c, PIEL, 0.7) : mezcla(c, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8], ruido(x, y, z, s + 1) * 0.7));
  const cuerpo = unir([
    caja(0.45, 0.675, 0.225, 0, 1.0125, 0, (x, y, z) => rota(ROPA, x, y, z, 21)),
    caja(0.45, 0.45, 0.45, 0, 1.575, 0, (x, y, z) => (z < -0.2 && Math.abs(Math.abs(x) - 0.1) < 0.05 && y > -0.02 && y < 0.07 ? OJO : mezcla(PIEL, [PIEL[0] * 0.85, PIEL[1] * 0.85, PIEL[2] * 0.85], ruido(x, y, z, 22) * 0.9))),
  ]);
  const pierna = caja(0.225, 0.675, 0.225, 0, -0.3375, 0, (x, y, z) => rota(PANTALON, x, y, z, 23));
  const brazo = caja(0.225, 0.675, 0.225, 0, -0.3375, 0, (x, y, z) => (y > 0.1 ? rota(ROPA, x, y, z, 24) : mezcla(PIEL, [PIEL[0] * 0.85, PIEL[1] * 0.85, PIEL[2] * 0.85], ruido(x, y, z, 25))));
  return {
    cuerpo,
    patas: [[-0.1125, 0.675, 0], [0.1125, 0.675, 0]].map(([x, y, z]) => ({ x, y, z, geo: pierna })),
    brazos: [[-0.3375, 1.31, 0], [0.3375, 1.31, 0]].map(([x, y, z]) => ({ x, y, z, geo: brazo })),
  };
}

// Modelo para los mobs de los mods: la forma ('cuadrupedo' | 'humanoide') pintada con dos colores (el del cuerpo y otro para detalles)
function modeloGenerico(d) {
  const c1 = d.color, c2 = d.color2 || c1.map(v => v * 0.65), OJO = d.ojos || [0.08, 0.06, 0.06];
  const oscurecer = (c, k) => c.map(v => v * k);
  const tono = (c, x, y, z, s) => mezcla(c, oscurecer(c, 0.85), ruido(x, y, z, s) * 0.9);
  if (d.forma === 'humanoide') {
    const cuerpo = unir([
      caja(0.45, 0.675, 0.225, 0, 1.0125, 0, (x, y, z) => tono(c2, x, y, z, 31)),
      caja(0.45, 0.45, 0.45, 0, 1.575, 0, (x, y, z) => (z < -0.2 && Math.abs(Math.abs(x) - 0.1) < 0.05 && y > -0.02 && y < 0.07 ? OJO : tono(c1, x, y, z, 32))),
    ]);
    const pierna = caja(0.225, 0.675, 0.225, 0, -0.3375, 0, (x, y, z) => tono(c2, x, y, z, 33));
    const brazo = caja(0.225, 0.675, 0.225, 0, -0.3375, 0, (x, y, z) => tono(y > 0.1 ? c2 : c1, x, y, z, 34));
    return {
      cuerpo,
      patas: [[-0.1125, 0.675, 0], [0.1125, 0.675, 0]].map(([x, y, z]) => ({ x, y, z, geo: pierna })),
      brazos: [[-0.3375, 1.31, 0], [0.3375, 1.31, 0]].map(([x, y, z]) => ({ x, y, z, geo: brazo })),
    };
  }
  const e = d.escala || 1, alto = 0.3 * e;                                   // cuadrupedo
  const cuerpo = unir([
    caja(0.5 * e, 0.46 * e, 0.8 * e, 0, alto + 0.23 * e, 0.05 * e, (x, y, z) => tono(c1, x, y, z, 35)),
    caja(0.4 * e, 0.38 * e, 0.36 * e, 0, alto + 0.32 * e, -0.5 * e, (x, y, z) => (z < -0.15 * e && Math.abs(Math.abs(x) - 0.1 * e) < 0.05 * e && y > 0 && y < 0.09 * e ? OJO : tono(c2, x, y, z, 36))),
  ]);
  const pata = caja(0.15 * e, alto, 0.15 * e, 0, -alto / 2, 0, (x, y, z) => tono(c2, x, y, z, 37));
  return { cuerpo, patas: [[-0.14, -0.2], [0.14, -0.2], [-0.14, 0.28], [0.14, 0.28]].map(([x, z]) => ({ x: x * e, y: alto, z: z * e, geo: pata })), brazos: [] };
}

// Para mods (mods.js): suma un tipo de mob. def: { nombre, forma, color, color2, escala, vida, vel, pasivo | hostil, danio, botin: [[id, min, max, prob]] }
function registrarTipo(clave, def) {
  if (!['cuadrupedo', 'humanoide'].includes(def.forma)) throw new Error('forma desconocida: ' + def.forma + " (usa 'cuadrupedo' o 'humanoide')");
  if (!Array.isArray(def.color) || def.color.length !== 3) throw new Error('el mob necesita un color: [r, g, b] con valores de 0 a 1');
  if (!!def.pasivo === !!def.hostil) throw new Error("el mob tiene que ser o pasivo o hostil (poné pasivo: true o hostil: true)");
  const e = def.escala || 1, humano = def.forma === 'humanoide';
  TIPOS[clave] = {
    nombre: def.nombre || clave, vida: def.vida || 10, w: humano ? 0.3 : 0.4 * e, h: humano ? 1.8 : 0.9 * e, vel: def.vel || 1.8,
    pasivo: !!def.pasivo, hostil: !!def.hostil, danio: def.danio || 2, botin: def.botin || [], modelo: () => modeloGenerico(def), mod: true,
  };
}

// vida: puntos (como el jugador: 20 = 10 corazones). w = medio ancho de la caja de choque, h = alto, vel = rapidez al caminar.
// botin: [id, minimo, maximo, probabilidad]. danio: lo que pega al jugador (hostiles).
const TIPOS = {
  cerdo: { nombre: 'Cerdo', vida: 10, w: 0.4, h: 0.9, vel: 1.8, pasivo: true, modelo: modeloCerdo, botin: [[ID.CARNE, 1, 2, 1]] },
  vaca: { nombre: 'Vaca', vida: 10, w: 0.45, h: 1.4, vel: 1.6, pasivo: true, modelo: modeloVaca, botin: [[ID.CARNE, 1, 3, 1]] },
  zombi: { nombre: 'Zombi', vida: 20, w: 0.3, h: 1.8, vel: 2.5, hostil: true, danio: 3, modelo: modeloZombi, botin: [[ID.LINGOTE, 1, 1, 0.15]] },
};
const modelos = {};                                       // los modelos se arman una vez por tipo y se comparten

// ---------- 2. Mobs ----------
const mobs = [];
const baseMat = new THREE.MeshLambertMaterial({ vertexColors: true });

function spawnMob(tipo, x, y, z) {
  const def = TIPOS[tipo];
  const mod = modelos[tipo] || (modelos[tipo] = def.modelo());
  const mat = baseMat.clone();                            // uno por mob: el destello rojo al recibir un golpe
  const grupo = new THREE.Group();
  const malla = (geo, px, py, pz) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    if (px === undefined) { grupo.add(m); return m; }
    const pivote = new THREE.Group(); pivote.position.set(px, py, pz); pivote.add(m); grupo.add(pivote);
    return pivote;
  };
  malla(mod.cuerpo);
  const patas = mod.patas.map(p => malla(p.geo, p.x, p.y, p.z));
  const brazos = mod.brazos.map(p => { const b = malla(p.geo, p.x, p.y, p.z); b.rotation.x = -1.35; return b; });   // los zombis caminan con los brazos adelante
  grupo.position.set(x, y, z);
  scene.add(grupo);
  const m = {
    tipo, def, grupo, patas, brazos, mat,
    pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), onGround: false,
    yaw: Math.random() * Math.PI * 2, vida: def.vida,
    t: Math.random() * 2, dirX: 0, dirZ: 0, caminando: false,       // paseo al azar
    huir: 0, huirDe: new THREE.Vector2(), ataque: 0.5, golpe: 0, muriendo: 0, paso: 0, bloqueado: 0, quemando: false,
  };
  mobs.push(m);
  return m;
}

function quitar(m) {
  scene.remove(m.grupo);
  m.mat.dispose();
  const i = mobs.indexOf(m);
  if (i >= 0) mobs.splice(i, 1);
}

const dif = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// ¿Hay algo solido arriba (techo, copa de arbol) hasta 24 bloques? Si no, el sol le da.
function expuestoAlSol(m) {
  const x = Math.floor(m.pos.x), z = Math.floor(m.pos.z);
  for (let y = Math.floor(m.pos.y + m.def.h); y < Math.min(H, m.pos.y + 24); y++) if (isSolidB(getBlock(x, y, z))) return false;
  return true;
}

function actualizarMob(m, dt) {
  const def = m.def, p = m.pos;
  if (m.muriendo > 0) {                                                       // se cae de costado y desaparece
    m.muriendo -= dt;
    m.grupo.rotation.z = Math.min(1, 1 - m.muriendo / 0.4) * Math.PI / 2;
    if (m.muriendo <= 0) quitar(m);
    return;
  }
  const dxp = player.pos.x - p.x, dzp = player.pos.z - p.z, dist = Math.hypot(dxp, dzp);
  if (dist > 80) { quitar(m); return; }
  if (!chunkLoaded(Math.floor(p.x), Math.floor(p.z))) return;                // el suelo todavia no existe: quieto

  // ---- IA: hacia donde quiere ir (wx, wz unitario) y a que rapidez
  let wx = 0, wz = 0, rapidez = 0;
  if (m.huir > 0) {                                                           // huye de lo que lo golpeo
    m.huir -= dt;
    const dx = p.x - m.huirDe.x, dz = p.z - m.huirDe.y, l = Math.hypot(dx, dz) || 1;
    wx = dx / l; wz = dz / l; rapidez = def.vel * 2;
  } else if (def.hostil && dist < 24 && !player.muerto) {                     // persigue al jugador
    wx = dxp / (dist || 1); wz = dzp / (dist || 1); rapidez = def.vel;
    m.ataque -= dt;
    if (dist < 1.1 && Math.abs(player.pos.y - p.y) < 1.6 && m.ataque <= 0) { danar(def.danio, 'zombi'); m.ataque = 1; }
  } else {                                                                    // pasea: un rato quieto, un rato caminando hacia cualquier lado
    m.t -= dt;
    if (m.t <= 0) {
      m.caminando = Math.random() < 0.6;
      const a = Math.random() * Math.PI * 2; m.dirX = Math.cos(a); m.dirZ = Math.sin(a);
      m.t = m.caminando ? 2 + Math.random() * 3 : 1 + Math.random() * 3;
    }
    if (m.caminando) { wx = m.dirX; wz = m.dirZ; rapidez = def.vel * (def.hostil ? 0.5 : 1); }
  }
  if (rapidez > 0) m.yaw += dif(Math.atan2(-wx, -wz), m.yaw) * Math.min(1, 10 * dt);   // gira hacia donde va

  // ---- zombis y el sol
  m.quemando = !!def.hostil && daylight > 0.55 && expuestoAlSol(m);
  if (m.quemando) { m.vida -= 2 * dt; if (m.vida <= 0) { matar(m, false); return; } }

  // ---- fisica
  const pasos = Math.ceil(dt / 0.025), h = dt / pasos;                       // pasos cortos: caer rapido no atraviesa el piso
  let choco = false;
  for (let s = 0; s < pasos; s++) {
    const a = 1 - Math.exp(-8 * h);
    m.vel.x += (wx * rapidez - m.vel.x) * a;
    m.vel.z += (wz * rapidez - m.vel.z) * a;
    const enAgua = isWater(getBlock(Math.floor(p.x), Math.floor(p.y + 0.4), Math.floor(p.z)));
    if (enAgua) m.vel.y = Math.min(m.vel.y + 22 * h, 2.2);                    // flota
    else m.vel.y = Math.max(m.vel.y - CONFIG.gravity * h, -40);
    const estabaEnSuelo = m.onGround, vx = m.vel.x, vz = m.vel.z;
    m.onGround = false;
    moverEje(m, 'x', m.vel.x * h, def.w, def.h);
    moverEje(m, 'z', m.vel.z * h, def.w, def.h);
    const topo = (vx !== 0 && m.vel.x === 0) || (vz !== 0 && m.vel.z === 0);
    if (topo && rapidez > 0 && (estabaEnSuelo || enAgua)) m.vel.y = 8.2;      // salta un escalon
    choco = choco || topo;
    moverEje(m, 'y', m.vel.y * h, def.w, def.h);
  }
  m.bloqueado = choco && rapidez > 0 ? m.bloqueado + dt : 0;
  if (m.bloqueado > 0.8) { m.t = 0; m.huir = 0; m.bloqueado = 0; }           // no se puede pasar: elige otro rumbo
  if (p.y < -20) { quitar(m); return; }

  // ---- como se ve
  const vxz = Math.hypot(m.vel.x, m.vel.z);
  m.paso += dt * (2 + vxz * 3);
  const ang = Math.sin(m.paso) * Math.min(1, vxz / 2) * 0.8;
  m.patas.forEach((pata, i) => { pata.rotation.x = (i === 0 || i === 3 ? ang : -ang); });
  m.golpe = Math.max(0, m.golpe - dt);
  m.mat.emissive.setRGB(m.golpe > 0 ? 0.55 : m.quemando ? 0.25 : 0, 0, 0);      // rojo fuerte al recibir un golpe, tenue mientras se quema
  m.grupo.position.copy(p);
  m.grupo.rotation.y = m.yaw;
}

// ---------- 3. Aparicion ----------
let reloj = 0;
function intentarAparecer() {
  const vivos = mobs.filter(m => !m.muriendo);
  if (vivos.length >= CONFIG.maxMobs) return;
  const noche = daylight < 0.4;
  const zombis = vivos.filter(m => m.def.hostil).length, animales = vivos.length - zombis;
  const elegir = lista => lista[Math.floor(Math.random() * lista.length)];       // tambien aparecen los mobs de los mods
  let tipo;
  if (noche && zombis < 4) tipo = elegir(Object.keys(TIPOS).filter(k => TIPOS[k].hostil));
  else if (animales < 6) tipo = elegir(Object.keys(TIPOS).filter(k => TIPOS[k].pasivo));
  else return;
  if (!tipo) return;
  const ang = Math.random() * Math.PI * 2, r = tipo === 'zombi' ? 14 + Math.random() * 18 : 18 + Math.random() * 26;
  const x = Math.floor(player.pos.x + Math.cos(ang) * r), z = Math.floor(player.pos.z + Math.sin(ang) * r);
  if (!chunkLoaded(x, z)) return;
  for (let y = Math.min(H - 3, heightAt(x, z) + 12); y > 0; y--) {          // la superficie: el primer suelo con 2 de aire arriba
    const b = getBlock(x, y, z);
    if (isWater(b)) return;
    if (isSolidB(b) && b !== LEAVES && getBlock(x, y + 1, z) === 0 && getBlock(x, y + 2, z) === 0) {
      if (TIPOS[tipo].pasivo && b !== 1) return;                             // los animales, solo sobre cesped
      spawnMob(tipo, x + 0.5, y + 1.01, z + 0.5);
      return;
    }
  }
}

// dt = 0 en pausa (los mobs no se mueven)
function actualizarMobs(dt) {
  if (dt <= 0) return;
  for (let i = mobs.length - 1; i >= 0; i--) actualizarMob(mobs[i], dt);
  if (!CONFIG.mobs || player.muerto) return;
  reloj += dt;
  const cada = mobs.length < 3 ? 0.3 : 1.5;                                   // al principio aparecen rapido
  if (reloj >= cada) { reloj = 0; intentarAparecer(); }
}

// ---------- 4. Combate ----------
// Rayo (origen, direccion unitaria) contra las cajas de los mobs. Devuelve { mob, t } del mas cercano a menos de `alcance`, o null.
function apuntarMob(ox, oy, oz, dx, dy, dz, alcance) {
  let mejor = null;
  for (const m of mobs) {
    if (m.muriendo > 0) continue;
    const w = m.def.w, h = m.def.h, p = m.pos;
    let t0 = 0, t1 = alcance;
    for (const [o, d, lo, hi] of [[ox, dx, p.x - w, p.x + w], [oy, dy, p.y, p.y + h], [oz, dz, p.z - w, p.z + w]]) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { t1 = -1; break; } continue; }
      let a = (lo - o) / d, b = (hi - o) / d;
      if (a > b) { const x = a; a = b; b = x; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t0 > t1) break;
    }
    if (t0 <= t1 && t1 >= 0 && (!mejor || t0 < mejor.t)) mejor = { mob: m, t: t0 };
  }
  return mejor;
}

// Pega `danio` puntos; (ox, oz) es de donde viene el golpe (el mob sale empujado hacia el lado contrario)
function golpear(m, danio, ox, oz) {
  if (m.muriendo > 0) return;
  m.vida -= danio; m.golpe = 0.3;
  const dx = m.pos.x - ox, dz = m.pos.z - oz, l = Math.hypot(dx, dz) || 1;
  m.vel.x = dx / l * 5; m.vel.z = dz / l * 5; m.vel.y = Math.max(m.vel.y, 4.5);
  if (m.def.pasivo) { m.huir = 4; m.huirDe.set(ox, oz); }
  if (m.vida <= 0) matar(m, true);
}

// Empieza a caerse de costado; si `botin`, suelta lo suyo (no en creativo)
function matar(m, botin) {
  m.muriendo = 0.4; m.vida = 0;
  emit('mob-muerto', { tipo: m.tipo, x: m.pos.x, y: m.pos.y, z: m.pos.z, botin });
  if (!botin || creative) return;
  for (const [id, min, max, prob] of m.def.botin) {
    if (Math.random() > prob) continue;
    const n = min + Math.floor(Math.random() * (max - min + 1));
    spawnDrop(id, n, m.pos.x, m.pos.y + m.def.h * 0.5, m.pos.z, (Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2);
  }
}

export { registrarTipo, mobs, TIPOS, spawnMob, actualizarMobs, apuntarMob, golpear, quitar };
