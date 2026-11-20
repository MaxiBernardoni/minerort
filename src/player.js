// ============================================================
// player.js - Estado del jugador y del mouse, compartido entre archivos.
// Vive aparte para que inventory.js y character.js lo usen sin depender de game.js.
// ============================================================
import * as THREE from 'three';

const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(),
  yaw: 0, pitch: 0, onGround: false, fly: false,
  // salud (la logica esta en salud.js): vida y hambre van de 0 a 20 (10 corazones y 10 muslos)
  vida: 20, hambre: 20, saturacion: 5, agotamiento: 0, muerto: false,
  // caidas: fallMax = punto mas alto desde que dejo el suelo; lastY detecta teletransportes
  fallMax: 0, lastY: 0,
  // punto de reaparicion del mundo (lo calcula game.js); ajustarSpawn = subirlo si quedo dentro de un bloque
  spawn: null, ajustarSpawn: false,
};
const mouse = { left: false, right: false };

// Hacia donde mira el jugador (vector unitario)
function lookDir() {
  const cp = Math.cos(player.pitch);
  return [-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp];
}

export { player, mouse, lookDir };
