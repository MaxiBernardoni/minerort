// ============================================================
// pruebas-reinicio.js - Se ejecuta DESPUES de reiniciar el juego (lo llama test/run.js).
// Comprueba lo que dejo guardado la ultima prueba de pruebas.js ("guardar: ...").
//   modo 'restaurado': el archivo estaba bien
//   modo 'respaldo':   el archivo principal estaba danado y se uso la copia de respaldo
//   modo 'nuevo':      los dos archivos estaban danados: el juego empieza un mundo nuevo
// Los numeros de abajo (CX, CZ, PY, el inventario, la hora, la salud...) tienen que coincidir con los de esa prueba.
// ============================================================
async (modo) => {
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const afirmar = (cond, msg) => { if (!cond) throw new Error(msg); };
  const cerca = (a, b, tol) => Math.abs(a - b) <= tol;
  const el = id => document.getElementById(id);
  const P = mc.player;
  const CX = 72, CZ = 40, PY = 60;
  const etiqueta = { restaurado: 'al reiniciar', respaldo: 'con el archivo danado', nuevo: 'sin archivo valido' }[modo];

  const resultados = [];
  const prueba = async (nombre, fn) => {
    try { resultados.push({ nombre: `${etiqueta}: ${nombre}`, ok: true, detalle: (await fn()) || '' }); }
    catch (e) { resultados.push({ nombre: `${etiqueta}: ${nombre}`, ok: false, detalle: (e && e.message) || String(e) }); }
  };
  const stack = (i) => mc.inventory[i] && `${mc.inventory[i].id}x${mc.inventory[i].count}`;
  await dormir(700);                                           // deja que la interfaz muestre la hora

  if (modo === 'nuevo') {
    await prueba('empieza un mundo nuevo y no se cae', async () => {
      afirmar(mc.chunks.size >= 200, `solo ${mc.chunks.size} chunks`);
      afirmar(mc.getBlock(CX + 3, PY + 3, CZ - 4) !== 8, 'aparecio la torre de la partida anterior');
      afirmar(stack(0) === '7x16' && stack(3) === null, `el inventario no es el inicial: ${stack(0)} / ${stack(3)}`);
      afirmar(el('modeBtn').textContent === 'Modo: Supervivencia', 'no empezo en supervivencia');
      afirmar(P.vida === 20 && P.hambre === 20, `la salud no es la inicial: ${P.vida}/${P.hambre}`);
      afirmar(mc.CONFIG.seed === 1337, `la semilla es ${mc.CONFIG.seed}`);
      return `${mc.chunks.size} chunks, inventario inicial`;
    });
    return resultados;
  }

  await prueba('vuelven los cambios al mundo (torre y hoyo)', async () => {
    afirmar(mc.getBlock(CX + 3, PY + 3, CZ - 4) === 8, 'la torre no esta');
    afirmar(mc.getBlock(CX + 3, PY + 1, CZ - 4) === 8, 'la base de la torre no esta');
    afirmar(mc.getBlock(CX + 4, PY, CZ + 4) === 0, 'el hoyo no esta');
    afirmar(mc.getBlock(CX, PY, CZ) === 3, 'la plataforma no esta');
  });

  await prueba('vuelven el inventario, la ranura elegida y el modo creativo', async () => {
    afirmar(stack(0) === '7x16' && stack(1) === '8x8' && stack(2) === '9x8', `barra: ${stack(0)} ${stack(1)} ${stack(2)}`);
    afirmar(stack(3) === '2x33', `ranura 4: ${stack(3)}, se esperaba 2x33`);
    afirmar(stack(12) === '5x7', `ranura 13: ${stack(12)}, se esperaba 5x7`);
    afirmar(stack(20) === `${mc.ID.PICO_PIEDRA}x1` && mc.inventory[20].dano === 7, `ranura 21: ${stack(20)} con desgaste ${mc.inventory[20] && mc.inventory[20].dano}, se esperaba el pico de piedra con desgaste 7`);
    const sel = [...document.querySelectorAll('#hotbar .slot')].findIndex(s => s.classList.contains('sel'));
    afirmar(sel === 3, `ranura elegida ${sel + 1}, se esperaba la 4`);
    afirmar(el('modeBtn').textContent === 'Modo: Creativo', 'no volvio el modo creativo');
  });

  await prueba('vuelven la vida, el hambre y el punto de aparicion', async () => {
    afirmar(P.vida === 13 && P.hambre === 7 && P.saturacion === 2, `salud ${P.vida}/${P.hambre}/${P.saturacion}, se esperaba 13/7/2`);
    afirmar(P.spawn && cerca(P.spawn.y, mc.heightAt(Math.floor(P.spawn.x), Math.floor(P.spawn.z)) + 1.01, 0.001),
      `el punto de aparicion no es el del mundo: ${JSON.stringify(P.spawn)}`);
  });

  await prueba('vuelven la hora y la posicion del jugador', async () => {
    const m = el('info').textContent.match(/Hora (\d\d):(\d\d)/);
    const min = +m[1] * 60 + +m[2];
    afirmar(min >= 20 * 60 + 20 && min <= 21 * 60 + 40, `la hora es ${m[1]}:${m[2]}, se esperaba cerca de las 20:24`);
    afirmar(cerca(P.pos.x, CX + 0.5, 0.01) && cerca(P.pos.z, CZ + 0.5, 0.01) && cerca(P.pos.y, PY + 1, 0.1),
      `posicion (${P.pos.x.toFixed(2)}, ${P.pos.y.toFixed(2)}, ${P.pos.z.toFixed(2)})`);
    afirmar(cerca(P.yaw, 1.2, 0.001) && cerca(P.pitch, -0.3, 0.001), `mira yaw=${P.yaw} pitch=${P.pitch}`);
    return `${m[1]}:${m[2]}`;
  });

  return resultados;
}
