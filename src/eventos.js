// ============================================================
// eventos.js - Avisos del juego a quien quiera escucharlos (los usan los mods; ver mods.js y docs/07-mods.md).
//   inicio         { }                                  el mundo ya esta cargado, antes del primer cuadro
//   cuadro         { dt }                               cada cuadro (cuidado: es codigo que corre 60 veces por segundo)
//   bloque-roto    { x, y, z, id }                      el jugador rompio un bloque (el bloque ya no esta)
//   bloque-puesto  { x, y, z, id }                      el jugador puso un bloque
//   mob-muerto     { tipo, x, y, z, botin }             un mob murio (botin = false si se quemo)
// Un oyente que falla 5 veces se deja de llamar (para que un mod roto no llene la consola ni trabe el juego).
// ============================================================

const EVENTOS = ['inicio', 'cuadro', 'bloque-roto', 'bloque-puesto', 'mob-muerto'];
const oyentes = {};
const MAX_ERRORES = 5;

function on(evento, funcion, dueno = '?') {
  if (!EVENTOS.includes(evento)) throw new Error(`evento desconocido "${evento}" (los que hay: ${EVENTOS.join(', ')})`);
  if (typeof funcion !== 'function') throw new Error('el oyente de "' + evento + '" tiene que ser una funcion');
  (oyentes[evento] || (oyentes[evento] = [])).push({ funcion, dueno, errores: 0 });
}

const hayOyentes = evento => !!(oyentes[evento] && oyentes[evento].length);

function emit(evento, datos) {
  const lista = oyentes[evento];
  if (!lista) return;
  for (const o of lista) {
    if (o.errores >= MAX_ERRORES) continue;
    try { o.funcion(datos); }
    catch (e) {
      console.error(`[mod ${o.dueno}] error en "${evento}" (${++o.errores}/${MAX_ERRORES}):`, e);
      if (o.errores >= MAX_ERRORES) console.error(`[mod ${o.dueno}] se deja de llamar a este oyente de "${evento}"`);
    }
  }
}

export { EVENTOS, on, emit, hayOyentes };
