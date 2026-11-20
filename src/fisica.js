// ============================================================
// fisica.js - Choque de cajas con los bloques del mundo. Lo usan el jugador (game.js) y los mobs (mobs.js).
// Un "cuerpo" es cualquier objeto con { pos: {x, y, z}, vel: {x, y, z}, onGround }. Su caja va centrada en (x, z)
// con los pies en y; el ancho y el alto se pasan en cada llamada (cada tipo de cuerpo tiene los suyos).
// ============================================================

import { isSolidB } from './config.js';
import { getBlock } from './world.js';

// ¿La caja (medio ancho w, alto h) con los pies en (px, py, pz) toca algun bloque solido?
function colisiona(px, py, pz, w, h) {
  const x0 = Math.floor(px - w), x1 = Math.floor(px + w - 1e-6);
  const y0 = Math.floor(py),     y1 = Math.floor(py + h - 1e-6);
  const z0 = Math.floor(pz - w), z1 = Math.floor(pz + w - 1e-6);
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        if (isSolidB(getBlock(x, y, z))) return true;
  return false;
}

// Mueve el cuerpo `d` bloques en un eje ('x' | 'y' | 'z'). Si choca, lo deja pegado al bloque y frena su velocidad en ese eje.
// Al chocar con el piso (cayendo) marca cuerpo.onGround = true.
function moverEje(cuerpo, eje, d, w, h) {
  if (!d) return;
  const p = cuerpo.pos;
  p[eje] += d;
  if (!colisiona(p.x, p.y, p.z, w, h)) return;
  if (eje === 'x') p.x = d > 0 ? Math.floor(p.x + w) - w - 1e-4 : Math.floor(p.x - w) + 1 + w + 1e-4;
  if (eje === 'z') p.z = d > 0 ? Math.floor(p.z + w) - w - 1e-4 : Math.floor(p.z - w) + 1 + w + 1e-4;
  if (eje === 'y') {
    if (d > 0) p.y = Math.floor(p.y + h) - h - 1e-4;
    else { p.y = Math.floor(p.y) + 1 + 1e-4; cuerpo.onGround = true; }
  }
  cuerpo.vel[eje] = 0;
}

export { colisiona, moverEje };
