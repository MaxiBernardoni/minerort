// ============================================================
// agua.js - Agua que fluye.
// Cada celda de aire o de agua que fluye "mira" a sus vecinos y se pone en el nivel que le toca:
//   - hay agua arriba                      -> nivel 1 (la cascada cae)
//   - una fuente (nivel 0) al costado      -> nivel 1
//   - agua que fluye (nivel L) al costado  -> nivel L + 1, hasta el 7 (donde se corta)
//   - el agua (fuente o fluyendo) sobre un hueco cae en vez de abrirse de costado
//   - sin nada que la alimente             -> desaparece (se va secando de a un nivel por paso)
// Solo se miran las celdas de world.js `activeWater`, que se llenan cuando un bloque cambia junto al agua.
// Ids: 10 = fuente, 20..26 = niveles 1..7 (ver config.js).
// ============================================================

import { WATER, isWater, nivelAgua } from './config.js';
import { getBlock, setBlock, rehacerMallas, activeWater, chunkLoaded } from './world.js';

const PASO = 0.2;            // segundos entre pasos
const PRESUPUESTO = 400;     // celdas que se miran por paso
let acumulado = 0;

const LADOS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const NIVEL_MAX = 7;         // la punta del agua que fluye (el id es 19 + nivel)
const NINGUNO = NIVEL_MAX + 1;   // "no le toca agua"

function decodificar(k) {
  const r = Math.floor(k / 64);
  return [Math.floor(r / 2097152) - 1048576, k % 64, (r % 2097152) - 1048576];
}

// Nivel (1..7) que le toca a esta celda segun sus vecinos, o NINGUNO
function nivelDeseado(x, y, z) {
  if (isWater(getBlock(x, y + 1, z))) return 1;
  let mejor = NINGUNO;
  for (const [dx, dz] of LADOS) {
    const n = getBlock(x + dx, y, z + dz);
    if (!isWater(n)) continue;
    const l = nivelAgua(n);
    const debajo = getBlock(x + dx, y - 1, z + dz);
    if (debajo === 0 || (isWater(debajo) && debajo !== WATER)) continue;            // ese vecino esta cayendo (sobre aire o agua que fluye): no se abre de costado
    if (l + 1 < mejor) mejor = l + 1;
  }
  return mejor;
}

function mirar(x, y, z) {
  const b = getBlock(x, y, z);
  if (b !== 0 && (!isWater(b) || b === WATER)) return false;        // solido o fuente: no cambia
  if (!chunkLoaded(x, z)) return false;
  const n = nivelDeseado(x, y, z), actual = b === 0 ? NINGUNO : nivelAgua(b);
  if (n === actual) return false;
  setBlock(x, y, z, n === NINGUNO ? 0 : 19 + n, true);              // la malla se rehace una vez por chunk al final del paso
  return true;
}

// Un paso: devuelve cuantas celdas cambiaron
function pasoAgua() {
  if (!activeWater.size) return 0;
  const lote = [];
  for (const k of activeWater) { lote.push(k); activeWater.delete(k); if (lote.length >= PRESUPUESTO) break; }
  let cambios = 0;
  for (const k of lote) { const [x, y, z] = decodificar(k); if (mirar(x, y, z)) cambios++; }
  rehacerMallas();
  return cambios;
}

function tickAgua(dt) {
  acumulado += dt;
  if (acumulado < PASO) return;
  acumulado = 0;
  pasoAgua();
}

export { tickAgua, pasoAgua };
