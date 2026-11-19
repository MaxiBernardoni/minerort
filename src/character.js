// ============================================================
// character.js - El cuerpo del jugador (cabeza, torso, brazos, piernas).
// En primera persona es invisible pero proyecta sombra en el suelo.
// En tercera persona (tecla V) se ve caminando, mirando y golpeando.
// ============================================================

import * as THREE from 'three';
import { scene } from './scene.js';
import { pixelBox, hand, SKIN, SHIRT } from './effects.js';

const PIX = 0.05625;                      // 1 "pixel" del modelo = 1.8 / 32
const HAIR = [0.28, 0.18, 0.10], PANTS = [0.22, 0.24, 0.52], SHOE = [0.30, 0.30, 0.34];
const charMaterials = [];
function charMat(color) {
  const m = new THREE.MeshLambertMaterial(color ? { color } : { vertexColors: true });
  charMaterials.push(m);
  return m;
}
const bodyMat = charMat();

const charRoot = new THREE.Group();
scene.add(charRoot);

function limb(x, y, w, h, colorAt) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  const seg = [Math.round(w / PIX), Math.round(h / PIX), Math.round(w / PIX)];
  const mesh = new THREE.Mesh(pixelBox(w, h, w, seg, colorAt, false, [0, -h / 2, 0]), bodyMat);
  mesh.castShadow = true;
  pivot.add(mesh);
  charRoot.add(pivot);
  return pivot;
}

// piernas (pantalon y zapatos)
const legL = limb(-0.1125, 0.675, 0.225, 0.675, (x, y) => (y < -0.25 ? SHOE : PANTS));
const legR = limb(0.1125, 0.675, 0.225, 0.675, (x, y) => (y < -0.25 ? SHOE : PANTS));
// brazos (manga y piel)
const armL = limb(-0.3375, 1.31, 0.225, 0.675, (x, y) => (y > 0.1 ? SHIRT : SKIN));
const armR = limb(0.3375, 1.31, 0.225, 0.675, (x, y) => (y > 0.1 ? SHIRT : SKIN));

// torso
const torso = new THREE.Mesh(
  pixelBox(0.45, 0.675, 0.225, [8, 12, 4], () => SHIRT, false, [0, 0.675 + 0.3375, 0]), bodyMat);
torso.castShadow = true;
charRoot.add(torso);

// cabeza (pelo arriba y atras, cara al frente = -Z)
const head = new THREE.Group();
head.position.set(0, 1.35, 0);
const headMesh = new THREE.Mesh(
  pixelBox(0.45, 0.45, 0.45, [8, 8, 8], (x, y, z) => (y > 0.14 || z > 0.17 ? HAIR : SKIN), false, [0, 0.225, 0]), bodyMat);
headMesh.castShadow = true;
head.add(headMesh);
[-1, 1].forEach(sx => {                                           // ojos
  const white = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.01), charMat(0xffffff));
  white.position.set(sx * 0.1, 0.2, -0.226);
  const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.012), charMat(0x2a3a7a));
  pupil.position.set(sx * 0.1 + sx * -0.012, 0.2, -0.227);
  head.add(white, pupil);
});
charRoot.add(head);

// ---------- primera / tercera persona ----------
let thirdPerson = false;
function setThirdPerson(v) {
  thirdPerson = v;
  // en primera persona el cuerpo no se pinta (ni color ni profundidad) pero sigue proyectando sombra
  charMaterials.forEach(m => { m.colorWrite = v; m.depthWrite = v; });
}
setThirdPerson(false);

// ---------- animacion ----------
let walkPhase = 0, walkAmt = 0;
function updateCharacter(player, dt, speedXZ, onGround) {
  charRoot.position.set(player.pos.x, player.pos.y, player.pos.z);
  charRoot.rotation.y = player.yaw;

  const target = (onGround || player.inWater) ? Math.min(1, speedXZ / 3.5) : 0.25;
  walkAmt += (target - walkAmt) * Math.min(1, dt * 10);
  walkPhase += dt * (3 + speedXZ * 1.6);
  const swing = Math.sin(walkPhase) * 0.85 * walkAmt;
  legL.rotation.x = swing;
  legR.rotation.x = -swing;
  armL.rotation.x = -swing;

  // el brazo derecho acompaña el golpe de la mano
  const s = hand.swing >= 0 ? Math.sin(hand.swing * Math.PI) : 0;
  armR.rotation.x = swing * (1 - s) - 1.5 * s;
  armR.rotation.z = -0.15 * s;
  head.rotation.x = player.pitch * 0.9;
}

export { thirdPerson, setThirdPerson, updateCharacter };
