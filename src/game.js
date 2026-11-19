// ============================================================
// game.js - Jugador, fisica, controles, interfaz y bucle principal.
// ============================================================

import * as THREE from 'three';
import { CONFIG, QUALITY, BLOCKS, CS, H, WATER, isSolidB } from './config.js';
import { renderer, scene, camera, handScene, handCamera, canvas, sun, applyRenderScale, renderScale } from './scene.js';
import { chunks, chunkKey, savedChunks, heightAt, getBlock, setBlock, updateChunks } from './world.js';
import { skyMesh, updateSky, daylight, setTime, skipTime, clockString } from './sky.js';
import { crackMesh, setCrackStage, hand, startSwing, spawnBreakParticles, updateParticles, updateHand } from './effects.js';
import { thirdPerson, setThirdPerson, updateCharacter } from './character.js';
import {
  inventory, invAdd, heldId, consumeHeld, selected, selectSlot, invOpen, openInventory, closeInventory,
  hotkeySwap, toast, lockPointer, setCreative, dropForBlock, updateDrops, drops, spawnDrop,
} from './inventory.js';
import { player, mouse, lookDir } from './player.js';
import { applyQuality } from './quality.js';

// Contorno del bloque apuntado
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
  new THREE.LineBasicMaterial({ color: 0x000000 })
);
highlight.visible = false;
scene.add(highlight);

// ---------- Jugador ----------
const W = 0.3, PH = 1.8, EYE = 1.62;           // medio ancho, alto, altura de los ojos
const view = { fov: CONFIG.fov, bobPhase: 0, bobAmt: 0, dip: 0 };   // efectos de camara

function collides(px, py, pz) {
  const x0 = Math.floor(px - W), x1 = Math.floor(px + W - 1e-6);
  const y0 = Math.floor(py),     y1 = Math.floor(py + PH - 1e-6);
  const z0 = Math.floor(pz - W), z1 = Math.floor(pz + W - 1e-6);
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        if (isSolidB(getBlock(x, y, z))) return true;
  return false;
}

function moveAxis(axis, d) {
  if (!d) return;
  const p = player.pos;
  p[axis] += d;
  if (!collides(p.x, p.y, p.z)) return;
  if (axis === 'x') p.x = d > 0 ? Math.floor(p.x + W) - W - 1e-4 : Math.floor(p.x - W) + 1 + W + 1e-4;
  if (axis === 'z') p.z = d > 0 ? Math.floor(p.z + W) - W - 1e-4 : Math.floor(p.z - W) + 1 + W + 1e-4;
  if (axis === 'y') {
    if (d > 0) p.y = Math.floor(p.y + PH) - PH - 1e-4;
    else { p.y = Math.floor(p.y) + 1 + 1e-4; player.onGround = true; }
  }
  player.vel[axis] = 0;
}

function physicsStep(dt) {
  const k = keys;
  const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
  const s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  let wx = -sin * f + cos * s, wz = -cos * f - sin * s;
  const len = Math.hypot(wx, wz);
  if (len > 0) { wx /= len; wz /= len; }

  const p = player.pos;
  const inWater = !player.fly && getBlock(Math.floor(p.x), Math.floor(p.y + 0.4), Math.floor(p.z)) === WATER;
  const headWater = getBlock(Math.floor(p.x), Math.floor(p.y + 1.6), Math.floor(p.z)) === WATER;
  player.inWater = inWater; player.headWater = headWater;

  const sprint = k.ShiftLeft || k.ShiftRight;
  let speed = player.fly ? CONFIG.flySpeed : (sprint ? CONFIG.sprintSpeed : CONFIG.walkSpeed);
  if (inWater) speed *= 0.55;
  const accel = player.fly ? 8 : (player.onGround ? 14 : (inWater ? 6 : 4));
  const a = 1 - Math.exp(-accel * dt);
  player.vel.x += (wx * speed - player.vel.x) * a;
  player.vel.z += (wz * speed - player.vel.z) * a;

  if (player.fly) {
    const ty = ((k.Space ? 1 : 0) - (sprint ? 1 : 0)) * 10;
    player.vel.y += (ty - player.vel.y) * (1 - Math.exp(-8 * dt));
  } else if (inWater) {                                   // nadar: poca gravedad, mucho roce
    player.vel.y -= 6 * dt;
    player.vel.y *= Math.exp(-2.5 * dt);
    player.vel.y = Math.max(player.vel.y, -3.5);
    if (k.Space) player.vel.y = headWater ? Math.min(player.vel.y + 34 * dt, 3.6) : Math.max(player.vel.y, 6.5);
  } else {
    player.vel.y = Math.max(player.vel.y - CONFIG.gravity * dt, -40);
    if (k.Space && player.onGround) player.vel.y = CONFIG.jumpSpeed;
  }

  const wasOnGround = player.onGround, prevVy = player.vel.y;
  player.onGround = false;
  moveAxis('x', player.vel.x * dt);
  moveAxis('z', player.vel.z * dt);
  moveAxis('y', player.vel.y * dt);
  if (player.onGround && !wasOnGround && prevVy < -9) view.dip = Math.min(0.3, (-prevVy - 8) * 0.03 + 0.05);   // golpe al aterrizar

  if (player.pos.y < -20) respawn();
}

function respawn() {
  const x = player.pos.x, z = player.pos.z;
  player.pos.set(x, heightAt(Math.floor(x), Math.floor(z)) + 2, z);
  player.vel.set(0, 0, 0);
}

// ---------- Raycast de bloques (DDA) ----------
function raycast(ox, oy, oz, dx, dy, dz, max) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  if (isSolidB(getBlock(x, y, z))) return null;
  const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
  const tdx = dx ? Math.abs(1 / dx) : Infinity;
  const tdy = dy ? Math.abs(1 / dy) : Infinity;
  const tdz = dz ? Math.abs(1 / dz) : Infinity;
  let tmx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : Infinity;
  let tmy = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : Infinity;
  let tmz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0;
  while (true) {
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
    else if (tmy < tmz)         { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
    else                        { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
    if (t > max || y < 0) return null;
    if (isSolidB(getBlock(x, y, z))) return { x, y, z, nx, ny, nz };
  }
}

// ---------- Entrada ----------
const keys = {};
let locked = false, placeCooldown = 0;

window.addEventListener('keydown', e => {
  if (invOpen) {                                              // con el inventario abierto
    if (e.code === 'KeyE' || e.code === 'Escape') { e.preventDefault(); closeInventory(); }
    else if (e.code.startsWith('Digit')) hotkeySwap(parseInt(e.code.slice(5), 10) - 1);
    return;
  }
  keys[e.code] = true;
  if (!locked) return;
  if (e.code === 'KeyE') openInventory();
  if (e.code === 'KeyF') { player.fly = !player.fly; player.vel.y = 0; toast(player.fly ? 'Modo vuelo' : 'Modo caminar'); }
  if (e.code === 'KeyV') { setThirdPerson(!thirdPerson); toast(thirdPerson ? 'Tercera persona' : 'Primera persona'); }
  if (e.code === 'KeyT') { skipTime(); toast('Hora ' + clockString()); }
  if (e.code === 'KeyK') {                                   // cambiar calidad: alta > media > baja
    const names = Object.keys(QUALITY), next = names[(names.indexOf(CONFIG.quality) + 1) % names.length];
    applyQuality(next); toast('Calidad: ' + next);
  }
  if (e.code === 'KeyG') { sun.castShadow = !sun.castShadow; toast(sun.castShadow ? 'Sombras: sí' : 'Sombras: no'); }
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.slice(5), 10);
    if (n >= 1 && n <= 9) selectSlot(n - 1);
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.left = mouse.right = false; });

document.addEventListener('mousemove', e => {
  if (!locked) return;
  player.yaw -= e.movementX * CONFIG.mouseSensitivity;
  player.pitch -= e.movementY * CONFIG.mouseSensitivity;
  player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch));
});
window.addEventListener('mousedown', e => {
  if (!locked) return;
  if (e.button === 0) mouse.left = true;
  if (e.button === 2) { mouse.right = true; placeCooldown = 0; }
});
window.addEventListener('mouseup', e => {
  if (e.button === 0) mouse.left = false;
  if (e.button === 2) mouse.right = false;
});
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('wheel', e => {
  if (!locked) return;
  selectSlot((selected + (e.deltaY > 0 ? 1 : -1) + 9) % 9);
});

const overlay = document.getElementById('overlay');
overlay.addEventListener('click', lockPointer);
canvas.addEventListener('click', () => { if (!locked && !invOpen) lockPointer(); });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  overlay.style.display = (locked || invOpen) ? 'none' : 'flex';
  if (!locked) mouse.left = mouse.right = false;
});

// ---------- Interfaz ----------
// (barra rapida, inventario y avisos viven en inventory.js)
const infoEl = document.getElementById('info');
const waterEl = document.getElementById('water');

// ---------- Romper (con grietas) / poner bloques ----------
let target = null;
const mining = { x: 0, y: 0, z: 0, p: 0, active: false, delay: 0 };

function updateMining(dt) {
  mining.delay = Math.max(0, mining.delay - dt);
  const can = locked && mouse.left && target && target.y > 0 && mining.delay <= 0;
  if (!can) { mining.active = false; mining.p = 0; crackMesh.visible = false; hand.mining = false; return; }
  if (!mining.active || mining.x !== target.x || mining.y !== target.y || mining.z !== target.z) {
    mining.active = true; mining.x = target.x; mining.y = target.y; mining.z = target.z; mining.p = 0;
  }
  const b = getBlock(mining.x, mining.y, mining.z);
  mining.p += dt * CONFIG.breakSpeed / BLOCKS[b].hardness;
  hand.mining = true;
  crackMesh.visible = true;
  crackMesh.position.set(mining.x + 0.5, mining.y + 0.5, mining.z + 0.5);
  setCrackStage(Math.min(9, Math.floor(mining.p * 10)));
  if (mining.p >= 1) {
    spawnBreakParticles(mining.x, mining.y, mining.z, b);
    setBlock(mining.x, mining.y, mining.z, 0);
    dropForBlock(b, mining.x, mining.y, mining.z);          // suelta el objeto (inventory.js)
    mining.active = false; mining.p = 0; mining.delay = 0.18;
    crackMesh.visible = false;
  }
}

function placeBlock() {
  const id = heldId();
  if (!target || !id) return;                               // mano vacia: no hay nada para poner
  const px = target.x + target.nx, py = target.y + target.ny, pz = target.z + target.nz;
  const here = getBlock(px, py, pz);
  if (py < 0 || py >= H || (here !== 0 && here !== WATER)) return;
  const p = player.pos;       // no poner un bloque dentro del jugador
  if (p.x + W > px && p.x - W < px + 1 && p.y + PH > py && p.y < py + 1 && p.z + W > pz && p.z - W < pz + 1) return;
  setBlock(px, py, pz, id);
  consumeHeld();                                            // gasta 1 del inventario (no en creativo)
  startSwing();
}

// ---------- Bucle principal ----------
let last = performance.now(), fpsTimer = 0, frames = 0, fps = 0;
const adapt = { t: 0, frames: 0, cool: 2, good: 0 };   // resolucion adaptativa

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  renderer.info.reset();
  updateChunks(player.pos.x, player.pos.z, 4, 3, 5);

  if (locked && chunks.has(chunkKey(Math.floor(player.pos.x / CS), Math.floor(player.pos.z / CS)))) {
    const steps = Math.ceil(dt / (1 / 90));
    for (let i = 0; i < steps; i++) physicsStep(dt / steps);
  }
  const speedXZ = Math.hypot(player.vel.x, player.vel.z);

  // camara: balanceo al caminar, golpe al aterrizar, FOV mas ancho al correr
  view.bobAmt += ((CONFIG.viewBobbing && player.onGround && !player.fly ? Math.min(1.3, speedXZ / CONFIG.walkSpeed) : 0) - view.bobAmt) * Math.min(1, dt * 8);
  view.bobPhase += dt * speedXZ * 1.7;
  view.dip *= Math.exp(-9 * dt);
  const sprinting = (keys.ShiftLeft || keys.ShiftRight) && speedXZ > CONFIG.walkSpeed + 0.5 && !player.fly;
  view.fov += ((CONFIG.fov + (sprinting ? 9 : 0)) - view.fov) * Math.min(1, dt * 7);
  if (Math.abs(camera.fov - view.fov) > 0.01) { camera.fov = view.fov; camera.updateProjectionMatrix(); }

  const eye = new THREE.Vector3(player.pos.x, player.pos.y + EYE - view.dip + Math.abs(Math.sin(view.bobPhase)) * -0.04 * view.bobAmt, player.pos.z);
  camera.position.copy(eye);
  camera.rotation.set(player.pitch, player.yaw, Math.sin(view.bobPhase) * 0.004 * view.bobAmt);
  const d = lookDir();
  if (thirdPerson) {                                        // camara detras del jugador, sin atravesar bloques
    let t = 0.3;
    while (t < CONFIG.thirdPersonDistance &&
           !isSolidB(getBlock(Math.floor(eye.x - d[0] * t), Math.floor(eye.y - d[1] * t), Math.floor(eye.z - d[2] * t)))) t += 0.15;
    t = Math.max(0.3, t - 0.3);
    camera.position.set(eye.x - d[0] * t, eye.y - d[1] * t, eye.z - d[2] * t);
  }

  updateSky(dt);

  target = raycast(eye.x, eye.y, eye.z, d[0], d[1], d[2], CONFIG.reach);
  highlight.visible = !!target;
  if (target) highlight.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);

  updateMining(dt);
  placeCooldown -= dt;
  if (locked && !mouse.left && mouse.right && placeCooldown <= 0) { placeBlock(); placeCooldown = 0.22; }

  updateParticles(dt);
  updateDrops(dt);
  updateHand(dt, speedXZ, player.onGround);
  updateCharacter(player, dt, speedXZ, player.onGround);

  // bajo el agua: niebla azul y corta, sin cielo
  const cx = Math.floor(camera.position.x), cy = Math.floor(camera.position.y), cz = Math.floor(camera.position.z);
  const underwater = getBlock(cx, cy, cz) === WATER && camera.position.y < cy + 0.88;
  waterEl.style.display = underwater ? 'block' : 'none';
  skyMesh.visible = !underwater;
  if (underwater) {
    scene.fog.color.setRGB(0.08 * daylight + 0.02, 0.28 * daylight + 0.04, 0.5 * daylight + 0.06);
    scene.fog.near = 0.5; scene.fog.far = 24;
    renderer.setClearColor(scene.fog.color);
  }

  renderer.clear();
  renderer.render(scene, camera);
  if (!thirdPerson) {                                       // la mano solo en primera persona
    renderer.clearDepth();
    renderer.render(handScene, handCamera);
  }

  frames++; fpsTimer += dt;
  adapt.t += dt; adapt.frames++;
  if (adapt.t >= 1) {
    const f = adapt.frames / adapt.t;
    adapt.t = 0; adapt.frames = 0;
    if (CONFIG.adaptiveResolution) {
      if (adapt.cool > 0) adapt.cool--;
      else if (f < CONFIG.targetFPS - 10 && renderScale > CONFIG.minRenderScale + 0.01) {   // va lento: bajar resolucion
        applyRenderScale(Math.max(CONFIG.minRenderScale, renderScale - 0.1)); adapt.cool = 2; adapt.good = 0;
      } else if (f >= CONFIG.targetFPS - 2 && renderScale < 1) {                              // sobra: subirla de a poco
        if (++adapt.good >= 4) { applyRenderScale(Math.min(1, renderScale + 0.05)); adapt.good = 0; adapt.cool = 1; }
      } else adapt.good = 0;
    }
  }
  if (fpsTimer >= 0.5) {
    fps = Math.round(frames / fpsTimer); frames = 0; fpsTimer = 0;
    const p = player.pos;
    infoEl.textContent = `FPS ${fps}\nXYZ ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}\nHora ${clockString()} · ${player.fly ? 'Volando' : player.inWater ? 'Nadando' : 'Caminando'} · chunks ${chunks.size}
Calidad ${CONFIG.quality} · res ${Math.round(renderScale * 100)}% · ${renderer.info.render.calls} llamadas · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris`;
  }
}

// ---------- Inicio ----------
setTimeout(() => {
  // Buscar un punto de aparicion sobre cesped (no en la arena de los valles)
  let bx = 8, bz = 8;
  for (let r = 0; r < 120; r += 4) {
    const x = 8 + r, z = 8 + Math.floor(r / 2);
    if (heightAt(x, z) > CONFIG.seaLevel + 3) { bx = x; bz = z; break; }
  }
  const sx = bx + 0.5, sz = bz + 0.5;
  applyQuality(CONFIG.quality);
  updateChunks(sx, sz, 1e9, 1e9, 1e9);                  // carga inicial completa
  player.pos.set(sx, heightAt(bx, bz) + 1.01, sz);
  document.getElementById('status').textContent = '';
  document.getElementById('playBtn').style.display = 'block';
  requestAnimationFrame(frame);
}, 30);

// Util para experimentar desde la consola (F12)
window.mc = { CONFIG, BLOCKS, player, chunks, savedChunks, chunkKey, getBlock, setBlock, heightAt, scene, camera, setTime,
              renderer, spawnBreakParticles, hand, mining, startSwing, selectSlot, sun, mouse,
              applyQuality, applyRenderScale, inventory, invAdd, openInventory, closeInventory, setThirdPerson, drops, spawnDrop, setCreative,
              setLocked: v => { locked = v; } };
