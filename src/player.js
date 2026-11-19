// ============================================================
// player.js - Estado del jugador y del mouse, compartido entre archivos.
// Vive aparte para que inventory.js y character.js lo usen sin depender de game.js.
// ============================================================
import * as THREE from 'three';

const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(),
  yaw: 0, pitch: 0, onGround: false, fly: false,
};
const mouse = { left: false, right: false };

// Hacia donde mira el jugador (vector unitario)
function lookDir() {
  const cp = Math.cos(player.pitch);
  return [-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp];
}

export { player, mouse, lookDir };
