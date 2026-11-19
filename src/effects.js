// ============================================================
// effects.js - Particulas al romper, grietas, y la mano animada.
// ============================================================

import * as THREE from 'three';
import { CONFIG, BLOCKS, isSolidB } from './config.js';
import { hash2, tileUV, tileAvg, atlasTexture, crackTextures } from './textures.js';
import { scene, handScene } from './scene.js';
import { getBlock, FACES, QUV } from './world.js';
import { daylight } from './sky.js';

// ---------- Particulas (una sola InstancedMesh = 1 draw call) ----------
const MAX_PARTICLES = 400;
const particleMesh = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_PARTICLES
);
particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
particleMesh.frustumCulled = false;
particleMesh.count = 0;
for (let i = 0; i < MAX_PARTICLES; i++) particleMesh.setColorAt(i, new THREE.Color());
scene.add(particleMesh);
const particles = [];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

function spawnBreakParticles(x, y, z, blockId) {
  const avg = tileAvg[BLOCKS[blockId].tiles[2]];
  for (let i = 0; i < 18 && particles.length < MAX_PARTICLES; i++) {
    const k = 0.75 + Math.random() * 0.5;
    particles.push({
      x: x + Math.random(), y: y + Math.random(), z: z + Math.random(),
      vx: (Math.random() - 0.5) * 4, vy: 1 + Math.random() * 3.5, vz: (Math.random() - 0.5) * 4,
      size: 0.06 + Math.random() * 0.09, life: 0.6 + Math.random() * 0.5,
      r: avg[0] * k, g: avg[1] * k, b: avg[2] * k,
    });
  }
}

function updateParticles(dt) {
  particleMesh.material.color.setScalar(daylight);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy -= 22 * dt;
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
    if (isSolidB(getBlock(Math.floor(p.x), Math.floor(ny), Math.floor(p.z)))) { p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
    else p.y = ny;
    if (!isSolidB(getBlock(Math.floor(nx), Math.floor(p.y), Math.floor(p.z)))) p.x = nx; else p.vx *= -0.4;
    if (!isSolidB(getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(nz)))) p.z = nz; else p.vz *= -0.4;
  }
  particleMesh.count = particles.length;
  particles.forEach((p, i) => {
    const sc = p.size * Math.min(1, p.life * 3);          // se encogen al final
    _m.compose(_p.set(p.x, p.y, p.z), _q.identity(), _s.set(sc, sc, sc));
    particleMesh.setMatrixAt(i, _m);
    particleMesh.setColorAt(i, _c.setRGB(p.r, p.g, p.b));
  });
  particleMesh.instanceMatrix.needsUpdate = true;
  if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
}

// ---------- Grietas sobre el bloque que se rompe ----------
const crackMaterial = new THREE.MeshBasicMaterial({
  map: crackTextures[0], transparent: true, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});
const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), crackMaterial);
crackMesh.visible = false;
scene.add(crackMesh);
let crackStage = -1;
function setCrackStage(s) {
  if (s === crackStage) return;
  crackStage = s;
  crackMaterial.map = crackTextures[s];
}

// ---------- Mano / bloque en primera persona ----------
const HAND_SHADE = [0.85, 0.7, 1.0, 0.5, 0.8, 0.65];      // brillo de cada cara (+X -X +Y -Y +Z -Z)
const handMaterial = new THREE.MeshBasicMaterial({ map: atlasTexture, vertexColors: true, alphaTest: 0.5 });
const handGroup = new THREE.Group();
handScene.add(handGroup);
let handMesh = null;

function makeBlockGeometry(id) {
  const pos = [], col = [], uv = [], ind = [];
  FACES.forEach((F, fi) => {
    const base = pos.length / 3;
    for (let i = 0; i < 4; i++) {
      pos.push(F.v[i][0] - 0.5, F.v[i][1] - 0.5, F.v[i][2] - 0.5);
      col.push(HAND_SHADE[fi], HAND_SHADE[fi], HAND_SHADE[fi]);
      uv.push(...tileUV(BLOCKS[id].tiles[F.t], QUV[i][0], QUV[i][1]));
    }
    ind.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(ind);
  return g;
}

// Caja hecha de "pixeles": cada vertice tiene un color calculado por colorAt(x,y,z) (coordenadas locales).
// shade=true hornea un brillo por cara (para materiales sin luz, como la mano).
const SKIN = [0.87, 0.64, 0.47], SHIRT = [0.16, 0.58, 0.72];
function pixelBox(w, h, d, seg, colorAt, shade, offset) {
  const g = new THREE.BoxGeometry(w, h, d, seg[0], seg[1], seg[2]);
  const p = g.attributes.position, n = g.attributes.normal, col = [];
  for (let i = 0; i < p.count; i++) {
    const c = colorAt(p.getX(i), p.getY(i), p.getZ(i));
    let f = 1;
    if (shade) {
      const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
      f = ny > 0.5 ? 1 : ny < -0.5 ? 0.55 : nx > 0.5 ? 0.85 : nx < -0.5 ? 0.7 : nz > 0.5 ? 0.8 : 0.9;
    }
    const j = 0.96 + hash2(i, seg[0] * 7 + seg[2], 4242) * 0.08;      // leve ruido, parece textura
    col.push(c[0] * f * j, c[1] * f * j, c[2] * f * j);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (offset) g.translate(offset[0], offset[1], offset[2]);
  return g;
}

// ---------- Brazo + bloque en primera persona ----------
const armMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
// el brazo apunta hacia -Z (la punta es la mano); la manga es la parte de atras
const armMesh = new THREE.Mesh(
  pixelBox(0.095, 0.095, 0.8, [3, 3, 16], (x, y, z) => (z < -0.27 ? SKIN : SHIRT), true, [0, 0, 0.25]),
  armMaterial
);
handGroup.add(armMesh);

const hand = { swing: -1, mining: false, equip: 1, bobT: 0, bob: 0 };
function setHandBlock(id) {
  if (handMesh) { handGroup.remove(handMesh); handMesh.geometry.dispose(); handMesh = null; }
  hand.equip = 0;                        // animacion de "sacar" el objeto
  if (!id) return;                       // mano vacia: solo se ve el brazo
  handMesh = new THREE.Mesh(makeBlockGeometry(id), handMaterial);
  handMesh.scale.setScalar(0.1);
  handMesh.position.set(0, 0.075, -0.05);
  handMesh.rotation.y = 0.75;
  handGroup.add(handMesh);
}
function startSwing() { if (hand.swing < 0) hand.swing = 0; }

function updateHand(dt, speedXZ, onGround) {
  const light = Math.max(0.4, daylight);
  handMaterial.color.setScalar(light);
  armMaterial.color.setScalar(light);
  if (hand.mining) startSwing();
  if (hand.swing >= 0) {
    hand.swing += dt / 0.32;
    if (hand.swing >= 1) hand.swing = hand.mining ? 0 : -1;
  }
  hand.equip = Math.min(1, hand.equip + dt / 0.28);

  const moving = CONFIG.viewBobbing && onGround ? Math.min(1.3, speedXZ / CONFIG.walkSpeed) : 0;
  hand.bobT += dt * speedXZ * 1.7;
  hand.bob += (moving - hand.bob) * Math.min(1, dt * 8);

  const s = hand.swing >= 0 ? Math.sin(hand.swing * Math.PI) : 0;
  const eq = 1 - Math.pow(1 - hand.equip, 3);
  handGroup.position.set(
    0.27 - s * 0.16 + Math.cos(hand.bobT) * 0.016 * hand.bob,
    -0.21 - s * 0.1 - (1 - eq) * 0.55 - Math.abs(Math.sin(hand.bobT)) * 0.02 * hand.bob,
    -0.55 - s * 0.2
  );
  handGroup.rotation.set(0.55 - s * 1.0, 0.5 - s * 0.35, 0);
  handGroup.scale.setScalar(1);
}

export { spawnBreakParticles, updateParticles, crackMesh, setCrackStage, hand, setHandBlock, startSwing, updateHand, makeBlockGeometry, pixelBox, SKIN, SHIRT };
