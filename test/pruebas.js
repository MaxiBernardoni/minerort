// ============================================================
// pruebas.js - Las pruebas del juego. Las ejecuta test/run.js DENTRO de la pagina, con el mundo real.
// Es una unica funcion async que devuelve la lista de resultados [{ nombre, ok, detalle }].
// Para agregar una prueba: sumar un `await prueba('nombre', async () => { ... })` y usar `afirmar`.
// Casi todas arrancan con `await arena()`, que arma una plataforma plana y deja todo en un estado conocido.
// ============================================================
async (filtro = '') => {
  const P = mc.player;
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const esperar = async (cond, ms = 5000) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) { if (cond()) return true; await dormir(20); }
    return !!cond();
  };
  const tecla = (code, abajo = true) => window.dispatchEvent(new KeyboardEvent(abajo ? 'keydown' : 'keyup', { code, bubbles: true }));
  const apretar = async (code, ms) => { tecla(code); await dormir(ms); tecla(code, false); };
  const dobleEspacio = async (pausa = 80) => { tecla('Space'); tecla('Space', false); await dormir(pausa); tecla('Space'); tecla('Space', false); };   // dos toques seguidos
  const afirmar = (cond, msg) => { if (!cond) throw new Error(msg); };
  const cerca = (a, b, tol) => Math.abs(a - b) <= tol;
  const cuenta = id => mc.inventory.reduce((n, s) => n + (s && s.id === id ? s.count : 0), 0);
  const el = id => document.getElementById(id);
  const clic = (elemento, boton = 0, shift = false) => elemento.dispatchEvent(new MouseEvent('mousedown', { button: boton, shiftKey: shift, bubbles: true }));

  // En Electron sin ventana el bloqueo real del puntero se activa y se suelta solo, y el juego reacciona a
  // `pointerlockchange` poniendo "locked = false" (se ve el cartel de pausa y se ignoran las teclas).
  // Las pruebas manejan ese estado a mano con mc.setLocked(true), asi que se ignoran esos eventos.
  window.addEventListener('pointerlockchange', e => e.stopImmediatePropagation(), true);

  const resultados = [];
  const quiere = filtro ? new RegExp(filtro, 'i') : null;
  const prueba = async (nombre, fn) => {
    if (quiere && !quiere.test(nombre)) return;
    try { resultados.push({ nombre, ok: true, detalle: (await fn()) || '' }); }
    catch (e) { resultados.push({ nombre, ok: false, detalle: (e && e.message) || String(e) }); }
  };

  // Plataforma de piedra de 11x11 a y=60, por encima del terreno (alturas hasta 52) y dentro de un solo chunk.
  const CX = 72, CZ = 40, PY = 60;
  const claveArena = mc.chunkKey(Math.floor(CX / 16), Math.floor(CZ / 16));
  const arenaLista = () => { const c = mc.chunks.get(claveArena); return !!(c && c.meshed); };

  async function arena() {
    if (el('inventory').style.display === 'flex') tecla('KeyE');
    mc.mouse.left = mc.mouse.right = false;
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft']) tecla(k, false);
    mc.setLocked(true);
    el('overlay').style.display = 'none';
    P.fly = false; P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = 0;
    P.pos.set(CX + 0.5, PY + 1.01, CZ + 0.5);
    afirmar(await esperar(arenaLista, 15000), 'el chunk de la plataforma no se cargo');
    for (let x = CX - 5; x <= CX + 5; x++) for (let z = CZ - 5; z <= CZ + 5; z++) {
      if (mc.getBlock(x, PY, z) !== 3) mc.setBlock(x, PY, z, 3);
      for (let y = PY + 1; y <= PY + 3; y++) if (mc.getBlock(x, y, z) !== 0) mc.setBlock(x, y, z, 0);
    }
    mc.setThirdPerson(false); mc.setCreative(false);
    mc.CONFIG.mobs = false; mc.mobs.slice().forEach(mc.quitarMob);              // sin mobs que aparezcan solos (las pruebas de mobs los ponen a mano)
    mc.salud.resetear();                                                       // vida, hambre y el cartel de muerte
    if (mc.CONFIG.quality !== 'media') mc.applyQuality('media');
    mc.inventory.fill(null); mc.invAdd(7, 16); mc.invAdd(8, 8); mc.invAdd(9, 8); mc.selectSlot(0);
    while (mc.drops.length) { const d = mc.drops.pop(); mc.scene.remove(d.mesh); }
    mc.setTime(0.25);
    P.pos.set(CX + 0.5, PY + 1.01, CZ + 0.5); P.vel.set(0, 0, 0);
    P.fallMax = P.lastY = P.pos.y; P.agotamiento = 0;
    afirmar(await esperar(() => P.onGround, 3000), 'el jugador no quedo apoyado en la plataforma');
  }

  // El lago mas cercano al origen con al menos 2 bloques de agua y vecinos igual de hondos (para no caer en el borde)
  function buscarLago() {
    const mar = mc.CONFIG.seaLevel; let lago = null;
    for (let x = -1600; x <= 1600; x += 5) for (let z = -1600; z <= 1600; z += 5) {
      if (mc.heightAt(x, z) > mar - 2) continue;
      if ([[2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dz]) => mc.heightAt(x + dx, z + dz) > mar - 2)) continue;
      const d = Math.hypot(x, z); if (!lago || d < lago.d) lago = { x, z, d };
    }
    afirmar(lago, 'no se encontro un lago con 2 bloques de profundidad');
    return lago;
  }

  // ---------------- arranque y mundo ----------------
  await prueba('el juego arranca como modulos ES y genera el mundo', async () => {
    afirmar(typeof window.THREE === 'undefined', 'THREE es global: el codigo volvio a scripts globales');
    afirmar(mc.chunks.size >= 200, `solo ${mc.chunks.size} chunks cargados`);
    return `${mc.chunks.size} chunks`;
  });

  await prueba('los cuadros corren (requestAnimationFrame)', async () => {
    let n = 0; const t0 = performance.now();
    await new Promise(r => { const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
    afirmar(n >= 20, `solo ${n} cuadros en 1 s`);
    return `${n} cuadros por segundo`;
  });

  await prueba('el terreno es estable (misma semilla, mismas alturas)', async () => {
    // Si cambiaste la generacion del terreno a proposito, actualiza esta lista con los valores nuevos.
    const esperadas = [[0, 0, 23], [100, 100, 29], [-250, 300, 44], [64, 36, 32], [1000, -1000, 27], [-1500, -465, 24], [17, -33, 26], [512, 512, 42]];
    afirmar(mc.CONFIG.seed === 1337, `la semilla es ${mc.CONFIG.seed}, las alturas de referencia son de 1337`);
    for (const [x, z, h] of esperadas) afirmar(mc.heightAt(x, z) === h, `altura en (${x},${z}) es ${mc.heightAt(x, z)}, se esperaba ${h}`);
    return `${esperadas.length} puntos iguales`;
  });

  // ---------------- jugador ----------------
  await prueba('el jugador cae y aterriza sobre el suelo', async () => {
    await arena();
    P.pos.set(CX + 0.5, PY + 9, CZ + 0.5); P.onGround = false;               // onGround viejo seguiria en true hasta el proximo paso de fisica
    afirmar(await esperar(() => P.onGround && P.pos.y < PY + 3, 4000), 'no aterrizo en 4 s');
    afirmar(cerca(P.pos.y, PY + 1, 0.05), `quedo en y=${P.pos.y.toFixed(2)}, se esperaba ${PY + 1}`);
    return `y=${P.pos.y.toFixed(2)}`;
  });

  await prueba('salta alrededor de 1.3 bloques', async () => {
    await arena();
    const base = P.pos.y; let max = base;
    tecla('Space');
    const t0 = performance.now();
    while (performance.now() - t0 < 1200) { max = Math.max(max, P.pos.y); if (P.pos.y < max - 0.05) break; await dormir(10); }
    tecla('Space', false);
    const h = max - base;
    afirmar(h > 1.2 && h < 1.5, `salto de ${h.toFixed(2)} bloques`);
    return `${h.toFixed(2)} bloques`;
  });

  await prueba('no atraviesa una pared al caminar', async () => {
    await arena();
    for (let y = PY + 1; y <= PY + 3; y++) mc.setBlock(CX, y, CZ - 3, 3);     // la pared ocupa z de CZ-3 a CZ-2
    await apretar('KeyW', 1500);                                              // 1.5 s caminando recorreria ~6 bloques
    afirmar(cerca(P.pos.z, CZ - 1.7, 0.15), `quedo en z=${P.pos.z.toFixed(2)}, se esperaba cerca de ${CZ - 1.7}`);
    return `se frena en z=${P.pos.z.toFixed(2)}`;
  });

  await prueba('en creativo el doble toque de Espacio vuela y otro doble toque aterriza; un solo toque no vuela', async () => {
    await arena();
    mc.setCreative(true);
    await apretar('Space', 150); await dormir(500);                          // un toque solo (salto): no vuela
    afirmar(!P.fly, 'un solo toque de Espacio activó el vuelo');
    await dobleEspacio(); afirmar(P.fly, 'el doble toque de Espacio no activó el vuelo');
    const y0 = P.pos.y;
    await apretar('Space', 600);
    afirmar(P.pos.y - y0 > 2, `subio solo ${(P.pos.y - y0).toFixed(1)} bloques`);
    await dormir(500);                                                       // pasa el plazo del doble toque
    await dobleEspacio(); afirmar(!P.fly, 'otro doble toque no desactivó el vuelo');
    tecla('KeyF'); afirmar(!P.fly, 'la tecla F volvió a activar el vuelo');
    return `subio ${(P.pos.y - y0).toFixed(1)} bloques`;
  });

  await prueba('en supervivencia el doble toque de Espacio no vuela ni T cambia la hora, y al dejar el creativo volando se aterriza', async () => {
    await arena();                                                            // arena() deja el modo supervivencia
    const minutos = () => { const m = el('info').textContent.match(/Hora (\d\d):(\d\d)/); return +m[1] * 60 + +m[2]; };
    await dobleEspacio(); afirmar(!P.fly, 'el doble toque de Espacio hizo volar en supervivencia');
    await dormir(600); const antes = minutos();
    tecla('KeyT'); await dormir(700);
    const dif = (minutos() - antes + 1440) % 1440;
    afirmar(dif < 30, `T avanzó la hora ${dif} min en supervivencia (en creativo avanza ~180)`);
    await dormir(400);
    mc.setCreative(true); await dobleEspacio(); afirmar(P.fly, 'en creativo el doble toque no activó el vuelo');
    mc.setCreative(false); afirmar(!P.fly, 'al pasar a supervivencia siguió volando');
  });

  await prueba('tercera persona (V) y sombras (G)', async () => {
    await arena();
    tecla('KeyV'); afirmar(el('toast').textContent === 'Tercera persona', 'V no paso a tercera persona');
    await dormir(300);                                                        // dibuja unos cuadros con el cuerpo visible
    tecla('KeyV'); afirmar(el('toast').textContent === 'Primera persona', 'V no volvio a primera persona');
    const antes = mc.sun.castShadow;
    tecla('KeyG'); afirmar(mc.sun.castShadow === !antes, 'G no cambio las sombras');
    tecla('KeyG'); afirmar(mc.sun.castShadow === antes, 'G no restauro las sombras');
  });

  // ---------------- bloques ----------------
  // Rompe el bloque de enfrente (a la altura de los ojos, 1 bloque adelante) y devuelve cuantos segundos tardo
  async function romperDeEnfrente(id) {
    mc.setBlock(CX, PY + 2, CZ - 1, id);
    mc.mouse.left = true; const t0 = performance.now();
    const rompio = await esperar(() => mc.getBlock(CX, PY + 2, CZ - 1) === 0, 6000);
    const seg = (performance.now() - t0) / 1000;
    mc.mouse.left = false;
    afirmar(rompio, 'no se rompio en 6 s');
    return seg;
  }

  await prueba('rompe tierra con la mano (~0.5 s), suelta tierra y la recoge', async () => {
    await arena();
    mc.selectSlot(8);                                                         // mano vacia
    const antes = cuenta(2);
    const seg = await romperDeEnfrente(2);
    afirmar(seg > 0.3 && seg < 1.2, `tardo ${seg.toFixed(2)} s (esperado ~0.5)`);
    afirmar(await esperar(() => cuenta(2) === antes + 1, 4000), 'la tierra no llego al inventario');
    return `${seg.toFixed(2)} s, +1 tierra`;
  });

  await prueba('pone un bloque (gasta 1) y no lo pone dentro del jugador', async () => {
    await arena();
    const antes = cuenta(7);
    P.pitch = -1;                                                             // mira al piso, un bloque adelante
    mc.mouse.right = true;
    afirmar(await esperar(() => cuenta(7) < antes, 2000), 'no puso ningun bloque');
    mc.mouse.right = false; await dormir(400);
    afirmar(antes - cuenta(7) === 1, `gasto ${antes - cuenta(7)} tablones, se esperaba 1`);
    afirmar(mc.getBlock(CX, PY + 1, CZ - 1) === 7, 'el bloque no quedo donde se apunto');
    const medio = cuenta(7);
    P.pitch = -Math.PI / 2 + 0.02;                                            // mira a los pies
    mc.mouse.right = true; await dormir(500); mc.mouse.right = false;
    afirmar(cuenta(7) === medio, 'puso un bloque dentro del jugador');
  });

  await prueba('en modo creativo se pone sin gastar bloques', async () => {
    await arena();
    el('modeBtn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    afirmar(el('modeBtn').textContent === 'Modo: Creativo', 'no paso a creativo');
    afirmar(document.querySelectorAll('#invPanel .grid')[0].style.display !== 'none', 'no se ve el catalogo');
    const antes = cuenta(7);
    P.pitch = -1; mc.mouse.right = true;
    afirmar(await esperar(() => mc.getBlock(CX, PY + 1, CZ - 1) === 7, 2000), 'no puso el bloque');
    mc.mouse.right = false;
    afirmar(cuenta(7) === antes, 'gasto bloques en creativo');
    el('modeBtn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    afirmar(el('modeBtn').textContent === 'Modo: Supervivencia', 'no volvio a supervivencia');
  });

  await prueba('poner y quitar bloques en el borde de un chunk no da error', async () => {
    await arena();
    for (const [x, z] of [[64, 36], [63, 35], [79, 47], [80, 48], [CX, 32], [CX, 47]]) {
      mc.setBlock(x, PY + 3, z, 3); mc.setBlock(x, PY + 3, z, 0);
    }
    afirmar(arenaLista(), 'el chunk quedo sin malla');
  });

  // ---------------- objetos planos y la mano ----------------
  await prueba('objetos: la manzana es plana (mano y suelo) y un bloque es un cubo', async () => {
    await arena();
    // proporcion espesor/ancho de una malla: ~1 para un cubo, ~0.1 para un objeto plano
    const espesor = geo => { geo.computeBoundingBox(); const b = geo.boundingBox; return (b.max.z - b.min.z) / (b.max.x - b.min.x); };
    mc.inventory[2] = { id: 100, count: 1 }; mc.selectSlot(2);
    afirmar(mc.hand.mesh, 'no hay nada en la mano');
    let e = espesor(mc.hand.mesh.geometry);
    afirmar(e < 0.3, `la manzana en la mano tiene espesor/ancho ${e.toFixed(2)}: es un cubo, tiene que ser plana`);
    mc.selectSlot(0);                                                                      // tablones
    e = espesor(mc.hand.mesh.geometry);
    afirmar(e > 0.95, `el bloque en la mano tiene espesor/ancho ${e.toFixed(2)}: tiene que ser un cubo`);
    mc.spawnDrop(100, 1, CX + 0.5, PY + 1.5, CZ - 1.5, 0, 0, 0);
    mc.spawnDrop(7, 1, CX + 1.5, PY + 1.5, CZ - 1.5, 0, 0, 0);
    const [manzana, bloque] = mc.drops.slice(-2);
    afirmar(espesor(manzana.mesh.geometry) < 0.3, 'la manzana en el suelo es un cubo');
    afirmar(espesor(bloque.mesh.geometry) > 0.95, 'el bloque en el suelo no es un cubo');
  });

  await prueba('mano: el objeto va en la punta del brazo (la mano), no a la mitad', async () => {
    await arena();
    // El brazo termina en z = -0.15 (hand.mesh queda en el mismo espacio que el brazo). A la mitad del brazo seria z ~ -0.05 o mas.
    for (const [ranura, id] of [[0, 7], [1, 8], [2, 100], [3, mc.ID.PICO_PIEDRA], [4, mc.ID.HACHA_MADERA]]) {
      mc.inventory[ranura] = { id, count: 1 }; mc.selectSlot(ranura);
      const z = mc.hand.mesh.position.z;
      afirmar(z <= -0.15 && z >= -0.35, `el objeto ${id} esta en z=${z.toFixed(2)}, se esperaba en la punta del brazo (entre -0.35 y -0.15)`);
    }
  });

  // ---------------- herramientas ----------------
  await prueba('herramientas: la piedra con la mano no suelta nada; con pico es ~4x mas rapida, suelta adoquin y gasta un uso', async () => {
    await arena();
    mc.selectSlot(8);                                                         // mano vacia
    const antesMano = cuenta(9);
    const segMano = await romperDeEnfrente(3);
    await dormir(1500);                                                       // si fuera a soltar algo, ya lo habria recogido
    afirmar(mc.drops.length === 0 && cuenta(9) === antesMano, `con la mano la piedra solto algo (${mc.drops.length} objetos en el suelo)`);
    mc.inventory[4] = { id: mc.ID.PICO_PIEDRA, count: 1 }; mc.selectSlot(4);
    const segPico = await romperDeEnfrente(3);
    afirmar(segPico < segMano / 2, `con el pico tardo ${segPico.toFixed(2)} s y con la mano ${segMano.toFixed(2)} s: no es mucho mas rapido`);
    afirmar(await esperar(() => cuenta(9) === antesMano + 1, 4000), 'con el pico el adoquin no llego al inventario');
    afirmar(mc.inventory[4] && mc.inventory[4].dano === 1, `el pico tiene desgaste ${mc.inventory[4] && mc.inventory[4].dano}, se esperaba 1`);
    return `mano ${segMano.toFixed(2)} s, pico ${segPico.toFixed(2)} s`;
  });

  await prueba('herramientas: cada una acelera solo su tipo de bloque', async () => {
    await arena();
    mc.inventory[4] = { id: mc.ID.HACHA_PIEDRA, count: 1 }; mc.selectSlot(4);
    const conHacha = await romperDeEnfrente(4);                               // madera: el hacha si
    const conHachaEnPiedra = await romperDeEnfrente(2);                       // tierra: el hacha no
    afirmar(conHacha < 0.5, `el hacha rompio madera en ${conHacha.toFixed(2)} s (esperado ~0.23)`);
    afirmar(conHachaEnPiedra > 0.3, `el hacha rompio tierra en ${conHachaEnPiedra.toFixed(2)} s: no deberia acelerarla (a mano ~0.45)`);
    return `madera ${conHacha.toFixed(2)} s, tierra ${conHachaEnPiedra.toFixed(2)} s`;
  });

  await prueba('herramientas: al agotarse se rompe y desaparece', async () => {
    await arena();
    mc.inventory[4] = { id: mc.ID.PALA_MADERA, count: 1, dano: 58 };         // dura 59: le queda un uso
    mc.selectSlot(4);
    await romperDeEnfrente(2);
    afirmar(mc.inventory[4] === null, 'la pala agotada sigue en el inventario');
    afirmar(/rompi/i.test(el('toast').textContent), `el aviso dice "${el('toast').textContent}"`);
  });

  await prueba('herramientas: no se apilan, no se ponen como bloque y conservan el desgaste al moverlas', async () => {
    await arena();
    mc.inventory.fill(null);
    afirmar(mc.invAdd(mc.ID.PICO_MADERA, 2) === 0, 'no entraron dos picos');
    afirmar(mc.inventory[0].count === 1 && mc.inventory[1] && mc.inventory[1].count === 1, 'dos picos se apilaron en una casilla');
    mc.inventory[0].dano = 5;
    mc.selectSlot(0); P.pitch = -1;
    mc.mouse.right = true; await dormir(500); mc.mouse.right = false;
    afirmar(mc.getBlock(CX, PY + 1, CZ - 1) === 0, 'puso el pico como si fuera un bloque');
    // moverlo con el mouse no le borra el desgaste
    tecla('KeyE');
    const grillas = document.querySelectorAll('#invPanel .grid'), barra = grillas[2].children, mochila = grillas[1].children;
    clic(barra[0]); clic(mochila[3]);                                         // de la barra a la mochila (casilla 12)
    afirmar(mc.inventory[0] === null && mc.inventory[12] && mc.inventory[12].dano === 5, 'el desgaste se perdio al moverlo');
    clic(mochila[3]); tecla('KeyE');                                          // lo agarra y cierra con el en la mano: vuelve a la mochila
    const vuelta = mc.inventory.find(s => s && s.id === mc.ID.PICO_MADERA && s.dano === 5);
    afirmar(vuelta, 'al cerrar con el pico en la mano se perdio su desgaste');
  });

  await prueba('recetas: forma, posicion y espejo', async () => {
    const r = (grilla, ancho) => { const x = mc.buscarReceta(grilla, ancho); return x ? `${x.id}x${x.count}` : null; };
    const { MADERA: M, TABLONES: T, ADOQUIN: A, PALO: S, MESA, PICO_MADERA, PICO_PIEDRA, HACHA_MADERA, PALA_MADERA, PALA_PIEDRA, LINGOTE: L, DIAMANTE: D, PICO_HIERRO, PICO_DIAMANTE, PALA_DIAMANTE, ESPADA_MADERA, ESPADA_PIEDRA, ESPADA_DIAMANTE } = mc.ID;
    const esperar_ = (obtenido, esperado, que) => afirmar(obtenido === esperado, `${que}: dio ${obtenido}, se esperaba ${esperado}`);
    esperar_(r([M, 0, 0, 0], 2), `${T}x4`, '1 madera en la esquina de 2x2');
    esperar_(r([0, 0, 0, M], 2), `${T}x4`, '1 madera en otra esquina');
    esperar_(r([0, 0, 0, 0, 0, 0, 0, M, 0], 3), `${T}x4`, '1 madera en el medio de 3x3');
    esperar_(r([T, 0, T, 0], 2), `${S}x4`, '2 tablones vertical a la izquierda');
    esperar_(r([0, T, 0, T], 2), `${S}x4`, '2 tablones vertical a la derecha');
    esperar_(r([T, T, 0, 0], 2), null, '2 tablones en horizontal no es un palo');
    esperar_(r([T, T, T, T], 2), `${MESA}x1`, 'mesa de crafteo');
    esperar_(r([T, T, T, 0, S, 0, 0, S, 0], 3), `${PICO_MADERA}x1`, 'pico de madera');
    esperar_(r([A, A, A, 0, S, 0, 0, S, 0], 3), `${PICO_PIEDRA}x1`, 'pico de piedra');
    esperar_(r([T, T, 0, T, S, 0, 0, S, 0], 3), `${HACHA_MADERA}x1`, 'hacha');
    esperar_(r([0, T, T, 0, S, T, 0, S, 0], 3), `${HACHA_MADERA}x1`, 'hacha espejada');
    esperar_(r([0, T, 0, 0, S, 0, 0, S, 0], 3), `${PALA_MADERA}x1`, 'pala');
    esperar_(r([0, A, 0, 0, S, 0, 0, S, 0], 3), `${PALA_PIEDRA}x1`, 'pala de piedra en el medio');
    esperar_(r([T, 0, 0, S, 0, 0, S, 0, 0], 3), `${PALA_MADERA}x1`, 'pala pegada a la izquierda');
    esperar_(r([L, L, L, 0, S, 0, 0, S, 0], 3), `${PICO_HIERRO}x1`, 'pico de hierro');
    esperar_(r([D, D, D, 0, S, 0, 0, S, 0], 3), `${PICO_DIAMANTE}x1`, 'pico de diamante');
    esperar_(r([0, D, 0, 0, S, 0, 0, S, 0], 3), `${PALA_DIAMANTE}x1`, 'pala de diamante');
    esperar_(r([T, 0, 0, T, 0, 0, S, 0, 0], 3), `${ESPADA_MADERA}x1`, 'espada de madera');
    esperar_(r([0, 0, A, 0, 0, A, 0, 0, S], 3), `${ESPADA_PIEDRA}x1`, 'espada de piedra pegada a la derecha');
    esperar_(r([0, D, 0, 0, D, 0, 0, S, 0], 3), `${ESPADA_DIAMANTE}x1`, 'espada de diamante en el medio');
    esperar_(r([T, 0, 0, T, 0, 0, T, 0, 0], 3), null, 'sin palo no hay espada');
    esperar_(r([T, A, T, 0, S, 0, 0, S, 0], 3), null, 'materiales mezclados');
    esperar_(r([T, T, T, 0, S, 0, 0, 0, 0], 3), null, 'pico incompleto');
    esperar_(r([0, 0, 0, 0], 2), null, 'grilla vacia');
    esperar_(r([T, T, S, S], 2), null, 'una pala no entra en 2x2');
  });

  await prueba('crafteo: en el inventario (2x2) se fabrica, se consume y los ingredientes sobrantes vuelven al cerrar', async () => {
    await arena();
    mc.inventory.fill(null); mc.inventory[3] = { id: mc.ID.MADERA, count: 3 };
    tecla('KeyE');
    afirmar(el('craftGrid2').style.display !== 'none' && el('craftGrid3').style.display === 'none', 'no se ve la grilla de 2x2');
    afirmar(/Inventario/.test(document.querySelector('.invTitle h2').textContent), 'el titulo no es "Inventario"');
    const grillas = document.querySelectorAll('#invPanel .grid'), barra = grillas[2].children;
    const celdas = document.querySelectorAll('#craftGrid2 .islot');
    clic(barra[3]); clic(celdas[1]);                                          // las 3 maderas, a la casilla de arriba a la derecha
    afirmar(mc.resultadoCraft() && mc.resultadoCraft().id === mc.ID.TABLONES && mc.resultadoCraft().count === 4, 'no aparecio el resultado (4 tablones)');
    clic(el('craftResultado'));                                               // saca 4 tablones
    afirmar(mc.craft[1] && mc.craft[1].count === 2, `quedaron ${mc.craft[1] && mc.craft[1].count} maderas, se esperaban 2`);
    clic(barra[0]);                                                           // los suelta en la casilla 0 de la barra
    afirmar(mc.inventory[0] && mc.inventory[0].id === mc.ID.TABLONES && mc.inventory[0].count === 4, 'los tablones no quedaron en la barra');
    clic(el('craftResultado'), 0, true);                                      // Shift+click: fabrica todo lo que se pueda (2 maderas -> 8 tablones)
    afirmar(mc.craft[1] === null, 'la madera no se consumio por completo');
    afirmar(mc.inventory.reduce((n, s) => n + (s && s.id === mc.ID.TABLONES ? s.count : 0), 0) === 12, 'no hay 12 tablones en total');
    // lo que queda en la grilla vuelve al inventario al cerrar
    mc.inventory.fill(null); mc.inventory[3] = { id: mc.ID.ADOQUIN, count: 5 };
    clic(document.querySelectorAll('#invPanel .grid')[2].children[3]); clic(celdas[0]);
    tecla('KeyE');
    afirmar(mc.craft.every(c => c === null), 'quedo algo en la grilla al cerrar');
    afirmar(mc.inventory.reduce((n, s) => n + (s && s.id === mc.ID.ADOQUIN ? s.count : 0), 0) === 5, 'se perdieron adoquines al cerrar con la grilla ocupada');
  });

  await prueba('mesa de crafteo: click derecho la abre (3x3), se fabrica un pico y no se pone un bloque al lado', async () => {
    await arena();
    mc.inventory.fill(null);
    mc.inventory[0] = { id: mc.ID.TABLONES, count: 10 }; mc.inventory[1] = { id: mc.ID.PALO, count: 10 }; mc.selectSlot(0);
    mc.setBlock(CX, PY + 2, CZ - 1, mc.ID.MESA);                              // enfrente, a la altura de los ojos
    mc.mouse.right = true;
    afirmar(await esperar(() => el('inventory').style.display === 'flex', 2000), 'el click derecho sobre la mesa no abrio nada');
    mc.mouse.right = false;
    afirmar(/Mesa/.test(document.querySelector('.invTitle h2').textContent), `el titulo es "${document.querySelector('.invTitle h2').textContent}"`);
    afirmar(el('craftGrid3').style.display !== 'none' && el('craftGrid2').style.display === 'none', 'no se ve la grilla de 3x3');
    afirmar(cuenta(mc.ID.TABLONES) === 10, 'abrir la mesa gasto tablones (puso un bloque)');
    const barra = document.querySelectorAll('#invPanel .grid')[2].children, celdas = document.querySelectorAll('#craftGrid3 .islot');
    clic(barra[0]); for (const k of [0, 1, 2]) clic(celdas[k], 2); clic(barra[0]);       // 3 tablones arriba, el resto vuelve
    clic(barra[1]); for (const k of [4, 7]) clic(celdas[k], 2); clic(barra[1]);          // 2 palos al medio y abajo
    afirmar(mc.resultadoCraft() && mc.resultadoCraft().id === mc.ID.PICO_MADERA, `el resultado es ${JSON.stringify(mc.resultadoCraft())}, se esperaba el pico de madera`);
    clic(el('craftResultado'));                                               // el pico queda en el cursor
    tecla('KeyE');                                                            // al cerrar, el pico va a la mochila
    afirmar(mc.inventory.some(s => s && s.id === mc.ID.PICO_MADERA), 'el pico no llego al inventario');
    afirmar(cuenta(mc.ID.TABLONES) === 7 && cuenta(mc.ID.PALO) === 8, `quedaron ${cuenta(mc.ID.TABLONES)} tablones y ${cuenta(mc.ID.PALO)} palos, se esperaban 7 y 8`);
    afirmar(mc.craft.every(c => c === null), 'quedo algo en la grilla');
  });

  await prueba('creativo: el catalogo tiene pestañas y un buscador que ignora los acentos', async () => {
    await arena();
    mc.setCreative(true);
    tecla('KeyE');
    const visibles = () => [...document.querySelectorAll('#invPanel .grid')[0].children].filter(c => c.style.display !== 'none').length;
    const buscar = txt => { const b = el('catalogBuscar'); b.value = txt; b.dispatchEvent(new Event('input')); };
    const pestana = clave => document.querySelector(`.pestana[data-clave="${clave}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const total = visibles();
    afirmar(total >= 18, `el catalogo muestra ${total} casillas, se esperaban al menos 18 (bloques y objetos)`);
    pestana('objetos'); const objetos = visibles();
    pestana('bloques'); const bloques = visibles();
    afirmar(objetos >= 8 && bloques >= 10 && objetos + bloques === total, `pestañas: ${objetos} objetos + ${bloques} bloques, total ${total}`);
    pestana('todo'); buscar('adoquin');
    afirmar(visibles() === 1, `buscar "adoquin" (sin acento) muestra ${visibles()}, se esperaba 1`);
    buscar('pico');
    afirmar(visibles() === 4, `buscar "pico" muestra ${visibles()}, se esperaba 4 (madera, piedra, hierro y diamante)`);
    buscar('zzz');
    afirmar(visibles() === 0, 'buscar algo que no existe deberia mostrar 0');
    buscar(''); afirmar(visibles() === total, 'vaciar el buscador no muestra todo de nuevo');
    tecla('KeyE'); mc.setCreative(false);
  });

  // ---------------- Fase 3: mundo mas rico ----------------
  // Chunks generados "en seco" (sin cargarlos en el juego): sirven para mirar el terreno sin viajar
  const generados = new Map();
  const generar = (cx, cz) => { const k = cx + ',' + cz; if (!generados.has(k)) generados.set(k, mc.generateChunk(cx, cz)); return generados.get(k); };
  const bloqueGen = (x, y, z) => generar(Math.floor(x / 16), Math.floor(z / 16)).data[y * 256 + (((z % 16) + 16) % 16) * 16 + (((x % 16) + 16) % 16)];
  // Cuenta los bloques de cada id en los chunks de un cuadrado de (2r+1)^2 centrado en (cx, cz)
  const contarChunks = (cx, cz, r) => {
    const n = {};
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { const d = generar(cx + dx, cz + dz).data; for (let i = 0; i < d.length; i++) if (d[i]) n[d[i]] = (n[d[i]] || 0) + 1; }
    return n;
  };

  await prueba('cuevas: hay tuneles bajo tierra (con techo), y generar un chunk dos veces da lo mismo', async () => {
    const aire = { n: 0, pasillo: 0, total: 0 };
    for (let dx = 0; dx < 5; dx++) for (let dz = 0; dz < 5; dz++) {
      const ch = generar(30 + dx, 30 + dz), d = ch.data;
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        const h = mc.heightAt((30 + dx) * 16 + x, (30 + dz) * 16 + z);
        for (let y = 3; y <= h - 4; y++) {
          aire.total++;
          if (d[y * 256 + z * 16 + x] === 0) {
            aire.n++;
            if (d[(y + 1) * 256 + z * 16 + x] === 0 && d[(y - 1) * 256 + z * 16 + x] !== 0) aire.pasillo++;   // alto como para pararse
          }
        }
      }
    }
    const fraccion = aire.n / aire.total;
    afirmar(fraccion > 0.01 && fraccion < 0.15, `${(fraccion * 100).toFixed(1)}% de lo que hay bajo tierra es aire (se esperaba entre 1% y 15%)`);
    afirmar(aire.pasillo > 100, `solo ${aire.pasillo} celdas de piso con 2 de alto: los tuneles son muy bajos`);
    const a = mc.generateChunk(31, 31), b = generar(31, 31);
    afirmar(a.data.every((v, i) => v === b.data[i]), 'el mismo chunk generado dos veces da distinto');
    return `${(fraccion * 100).toFixed(1)}% aire, ${aire.pasillo} pisos`;
  });

  await prueba('cuevas: los lagos no se vacian (el techo de 4 bloques) y las entradas llegan a la superficie', async () => {
    let lagos = 0, huecosBajoAgua = 0, entradas = 0;
    for (let dx = 0; dx < 12; dx++) for (let dz = 0; dz < 12; dz++) {
      const d = generar(20 + dx, 50 + dz).data;
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        const wx = (20 + dx) * 16 + x, wz = (50 + dz) * 16 + z, h = mc.heightAt(wx, wz);
        if (h < mc.CONFIG.seaLevel - 1) {                                     // bajo el agua: nada de aire entre el fondo y el agua
          lagos++;
          for (let y = h + 1; y <= mc.CONFIG.seaLevel; y++) if (d[y * 256 + z * 16 + x] === 0) huecosBajoAgua++;
        } else if (h > mc.CONFIG.seaLevel + 1 && d[h * 256 + z * 16 + x] === 0) entradas++;   // pozo que llega a la superficie
      }
    }
    afirmar(lagos > 500, `solo ${lagos} columnas bajo el agua para mirar`);
    afirmar(huecosBajoAgua === 0, `${huecosBajoAgua} bloques de aire dentro del agua de los lagos`);
    afirmar(entradas > 0, 'no hay ni un pozo de entrada que llegue a la superficie');
    return `${entradas} entradas`;
  });

  await prueba('minerales: hierro y diamante bajo tierra; el diamante solo en lo profundo', async () => {
    const n = contarChunks(40, 40, 3);
    const alturaMax = id => { let m = 0; for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { const d = generar(40 + dx, 40 + dz).data; for (let i = 0; i < d.length; i++) if (d[i] === id) m = Math.max(m, i >> 8); } return m; };
    afirmar((n[mc.ID.MINERAL_HIERRO] || 0) > 100, `solo ${n[mc.ID.MINERAL_HIERRO] || 0} bloques de hierro en 49 chunks`);
    afirmar((n[mc.ID.MINERAL_DIAMANTE] || 0) > 5, `solo ${n[mc.ID.MINERAL_DIAMANTE] || 0} bloques de diamante en 49 chunks`);
    afirmar((n[mc.ID.MINERAL_DIAMANTE] || 0) < (n[mc.ID.MINERAL_HIERRO] || 0) / 4, 'el diamante no es mas raro que el hierro');
    const ydiam = alturaMax(mc.ID.MINERAL_DIAMANTE), yhierro = alturaMax(mc.ID.MINERAL_HIERRO);
    afirmar(ydiam <= 17, `hay diamante a y=${ydiam} (solo debe haber hasta y=14 y algo de la veta)`);
    afirmar(yhierro <= 48, `hay hierro a y=${yhierro}`);
    return `hierro ${n[mc.ID.MINERAL_HIERRO]}, diamante ${n[mc.ID.MINERAL_DIAMANTE]} (y max ${ydiam})`;
  });

  await prueba('minerales: el hierro pide pico de piedra y el diamante pico de hierro; sin eso no sueltan nada', async () => {
    await arena();
    const { MINERAL_HIERRO: HIERRO, MINERAL_DIAMANTE: DIAM, LINGOTE, DIAMANTE, PICO_MADERA, PICO_PIEDRA, PICO_HIERRO } = mc.ID;
    const con = (pico, mineral) => { mc.inventory[4] = { id: pico, count: 1 }; mc.selectSlot(4); return romperDeEnfrente(mineral); };
    await con(PICO_MADERA, HIERRO); await dormir(1200);
    afirmar(cuenta(LINGOTE) === 0 && mc.drops.length === 0, 'el mineral de hierro soltó algo con un pico de madera');
    await con(PICO_PIEDRA, HIERRO);
    afirmar(await esperar(() => cuenta(LINGOTE) === 1, 4000), 'el pico de piedra no sacó un lingote del mineral de hierro');
    await con(PICO_PIEDRA, DIAM); await dormir(1200);
    afirmar(cuenta(DIAMANTE) === 0 && mc.drops.length === 0, 'el diamante soltó algo con un pico de piedra');
    const segPiedra = await con(PICO_PIEDRA, DIAM), segHierro = await con(PICO_HIERRO, DIAM);
    afirmar(await esperar(() => cuenta(DIAMANTE) === 1, 4000), 'el pico de hierro no sacó el diamante');
    afirmar(segHierro < segPiedra / 2, `el pico de hierro tardó ${segHierro.toFixed(2)} s y el de piedra ${segPiedra.toFixed(2)} s: el de piedra no debería acelerar lo que no puede recoger`);
    return `diamante: piedra ${segPiedra.toFixed(2)} s, hierro ${segHierro.toFixed(2)} s`;
  });

  await prueba('biomas: hay llanura, bosque, desierto y nevado, y cada uno tiene su superficie', async () => {
    const lugar = {};                                                         // un chunk del medio de cada bioma
    for (let cx = -60; cx <= 60 && Object.keys(lugar).length < 4; cx += 3) for (let cz = -60; cz <= 60; cz += 3) {
      const b = mc.biomeAt(cx * 16 + 8, cz * 16 + 8);
      const hc = mc.heightAt(cx * 16 + 8, cz * 16 + 8);
      if (lugar[b] === undefined && hc > mc.CONFIG.seaLevel + 3 && hc < 44 && [[-3, 0], [3, 0], [0, -3], [0, 3]].every(([dx, dz]) => mc.biomeAt((cx + dx) * 16 + 8, (cz + dz) * 16 + 8) === b)) lugar[b] = [cx, cz];
    }
    afirmar(Object.keys(lugar).length === 4, `solo se encontraron los biomas ${Object.keys(lugar).map(k => mc.BIOMA_NOMBRE[k])}`);
    const tope = (cx, cz) => {                                                // bloque de la superficie de cada columna con tierra firme
      const n = {};
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        const h = mc.heightAt(cx * 16 + x, cz * 16 + z);
        if (h > mc.CONFIG.seaLevel + 1 && h < 47) { const b = generar(cx, cz).data[h * 256 + z * 16 + x]; n[b] = (n[b] || 0) + 1; }
      }
      return n;
    };
    const [llanura, bosque, desierto, nevado] = [0, 1, 2, 3].map(b => tope(...lugar[b]));
    const casi = (n, id) => { const total = Object.values(n).reduce((a, b) => a + b, 0); return total > 30 && (n[id] || 0) >= 0.9 * total; };
    afirmar(casi(llanura, 1) && casi(bosque, 1), 'la llanura y el bosque no tienen césped');
    afirmar(casi(desierto, 6), `el desierto no es de arena: ${JSON.stringify(desierto)}`);
    afirmar(casi(nevado, mc.ID.NIEVE), `el nevado no es de nieve: ${JSON.stringify(nevado)}`);
    const arboles = [0, 1, 2, 3].map(b => contarChunks(lugar[b][0], lugar[b][1], 1));
    afirmar((arboles[2][mc.ID.CACTUS] || 0) > 0, 'no hay cactus en el desierto');
    afirmar((arboles[1][mc.ID.ABEDUL] || 0) > 0, 'no hay abedules en el bosque');
    afirmar((arboles[3][4] || 0) > 0 && (arboles[3][5] || 0) > 0, 'no hay pinos en el nevado');
    afirmar((arboles[1][4] || 0) > (arboles[0][4] || 0) * 2, `el bosque (${arboles[1][4]} de madera) no tiene bastante mas árboles que la llanura (${arboles[0][4] || 0})`);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const [cx, cz] of Object.values(lugar)) {          // cada cactus esta en una columna de desierto
      const ch = generar(cx + dx, cz + dz);
      for (let i = 0; i < ch.data.length; i++) if (ch.data[i] === mc.ID.CACTUS) {
        const x = (cx + dx) * 16 + (i & 15), z = (cz + dz) * 16 + ((i >> 4) & 15);
        afirmar(mc.biomeAt(x, z) === 2, `hay un cactus en (${x}, ${z}) que es ${mc.BIOMA_NOMBRE[mc.biomeAt(x, z)]}`);
      }
    }
    return `chunks de muestra: ${[0, 1, 2, 3].map(b => mc.BIOMA_NOMBRE[b] + ' ' + lugar[b]).join(', ')}`;
  });

  await prueba('estructuras: una cabaña tiene piso, paredes con esquinas, puerta, ventanas, techo y una mesa de crafteo', async () => {
    let cab = null;
    for (let gx = -12; gx <= 12 && !cab; gx++) for (let gz = -12; gz <= 12 && !cab; gz++) cab = mc.cabanaEn(gx, gz);
    afirmar(cab, 'no hay ninguna cabaña en 25x25 celdas');
    const { x, y, z } = cab, T = mc.ID.TABLONES;
    const b = (dx, dy, dz) => bloqueGen(x + dx, y + dy, z + dz);
    afirmar(b(3, 0, 3) === T && b(1, 0, 5) === T, 'el piso no es de tablones');
    afirmar(b(0, 1, 1) === T && b(6, 3, 4) === T && b(2, 2, 6) === T, 'las paredes no son de tablones');
    afirmar(b(0, 1, 0) === mc.ID.MADERA && b(6, 3, 6) === mc.ID.MADERA, 'las esquinas no son de madera');
    afirmar(b(3, 1, 6) === 0 && b(3, 2, 6) === 0, 'no hay puerta');
    afirmar(b(0, 2, 3) === 0 && b(6, 2, 3) === 0 && b(3, 2, 0) === 0, 'no hay ventanas');
    afirmar(b(3, 4, 3) === T && b(0, 4, 0) === mc.ID.ADOQUIN, 'el techo no está');
    afirmar(b(2, 2, 2) === 0 && b(1, 1, 1) === mc.ID.MESA, 'adentro hay un bloque de más o falta la mesa de crafteo');
    afirmar(b(3, 5, 3) === 0, 'queda algo encima del techo');
    return `cabaña en (${x}, ${z}) a y=${y}`;
  });

  await prueba('luz: bajo un techo se oscurece (por eso las cuevas son oscuras) y al sacarlo vuelve la luz', async () => {
    await arena();
    // una columna de piso firme sin nada encima, en el mismo chunk que la plataforma pero fuera de ella
    const cxv = Math.floor(CX / 16) - 1, czv = Math.floor(CZ / 16);                  // el chunk de al lado de la plataforma
    afirmar(await esperar(() => { const c = mc.chunks.get(mc.chunkKey(cxv, czv)); return !!(c && c.meshed); }, 15000), 'no se cargó el chunk vecino');
    const ch = mc.chunks.get(mc.chunkKey(cxv, czv));
    let sitio = null;
    for (let lx = 0; lx < 16 && !sitio; lx++) for (let lz = 0; lz < 16 && !sitio; lz++) {
      const wx = cxv * 16 + lx, wz = czv * 16 + lz;
      const h = mc.heightAt(wx, wz);
      if (h < mc.CONFIG.seaLevel + 2 || h > 50 || lx < 2 || lx > 13 || lz < 2 || lz > 13) continue;
      if (![1, 2, 6, 14].includes(mc.getBlock(wx, h, wz))) continue;
      let libre = true;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let y = h; y <= h + 10; y++) if (y > h && mc.getBlock(wx + dx, y, wz + dz) !== 0) libre = false;
      if (libre && h + 10 < 63) sitio = { wx, wz, h, lx, lz };
    }
    afirmar(sitio, 'no se encontró un lugar despejado para la prueba');
    // brillo (0..1) de los 4 vertices de la cara de arriba del bloque del suelo
    const brillo = () => {
      const g = ch.mesh.geometry, pos = g.attributes.position, col = g.attributes.color, nor = g.attributes.normal; let suma = 0, n = 0;
      for (let i = 0; i < pos.count; i++) {
        if (nor.getY(i) !== 1 || pos.getY(i) !== sitio.h + 1) continue;
        if (pos.getX(i) < sitio.lx || pos.getX(i) > sitio.lx + 1 || pos.getZ(i) < sitio.lz || pos.getZ(i) > sitio.lz + 1) continue;
        suma += col.getX(i); n++;
      }
      afirmar(n >= 4, `se encontraron ${n} vértices de la cara de arriba del suelo`);
      return suma / n;
    };
    const abierto = brillo();
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) mc.setBlock(sitio.wx + dx, sitio.h + 9, sitio.wz + dz, 3);   // un techo 8 bloques arriba
    const tapado = brillo();
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) mc.setBlock(sitio.wx + dx, sitio.h + 9, sitio.wz + dz, 0);
    const destapado = brillo();
    afirmar(abierto > 0.5, `al aire libre el brillo es ${abierto.toFixed(2)}`);
    afirmar(tapado < abierto * 0.99 && tapado < abierto * (mc.CONFIG.luzMinima + 0.2), `con techo el brillo es ${tapado.toFixed(2)}, al aire libre ${abierto.toFixed(2)}: no oscureció lo suficiente`);
    afirmar(Math.abs(destapado - abierto) < 0.01, `al sacar el techo el brillo es ${destapado.toFixed(2)} y debería volver a ${abierto.toFixed(2)}`);
    return `aire libre ${abierto.toFixed(2)}, con techo ${tapado.toFixed(2)}`;
  });

  // ---------------- agua que fluye ----------------
  const FLUYE = n => 19 + n;                                                    // ids 20..26 = niveles 1..7
  const esAgua = b => b === 10 || (b >= 20 && b <= 26);
  const pasosAgua = (max, cond) => { for (let i = 0; i < max; i++) { mc.pasoAgua(); if (cond && cond()) return i + 1; } return max; };
  // Celdas con agua en un cuadrado de +-r alrededor de (x, z), de la altura y0 para arriba
  const aguaAlrededor = (x, z, r, y0) => { let n = 0; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) for (let y = y0; y <= PY + 3; y++) if (esAgua(mc.getBlock(x + dx, y, z + dz))) n++; return n; };

  await prueba('agua que fluye: se abre en las 4 direcciones hasta el nivel 7, un bloque en el camino la rodea y sin fuente se seca', async () => {
    await arena();
    for (let i = -5; i <= 5; i++) for (const [x, z] of [[CX + i, CZ - 5], [CX + i, CZ + 5], [CX - 5, CZ + i], [CX + 5, CZ + i]]) { mc.setBlock(x, PY + 1, z, 3); mc.setBlock(x, PY + 2, z, 3); }   // un borde para que no se caiga
    const sx = CX - 4, sz = CZ - 4;                                             // la fuente, en una esquina de la plataforma
    mc.setBlock(sx, PY + 1, sz, 10);
    pasosAgua(40);
    const nivel = (dx, dz) => mc.getBlock(sx + dx, PY + 1, sz + dz);
    afirmar(nivel(1, 0) === FLUYE(1) && nivel(0, 1) === FLUYE(1), `al lado de la fuente hay ${nivel(1, 0)} y ${nivel(0, 1)}, se esperaba el nivel 1 (20)`);
    afirmar(nivel(3, 0) === FLUYE(3) && nivel(2, 1) === FLUYE(3), 'a 3 pasos no es el nivel 3');
    afirmar(nivel(7, 0) === FLUYE(7) && nivel(4, 3) === FLUYE(7), `a 7 pasos hay ${nivel(7, 0)}, se esperaba el nivel 7`);
    afirmar(nivel(8, 0) === 0 && nivel(8, 1) === 0 && nivel(8, 8) === 0, 'el agua llegó más lejos del nivel 7');
    // un bloque a 2 de la fuente: el agua lo rodea (5 pasos hasta el otro lado en vez de 3)
    mc.setBlock(sx + 2, PY + 1, sz, 3);
    pasosAgua(40);
    afirmar(nivel(3, 0) === FLUYE(5), `detrás del bloque hay ${nivel(3, 0)}, se esperaba el nivel 5 (rodea el bloque: 5 pasos en vez de 3)`);
    mc.setBlock(sx + 2, PY + 1, sz, 0);
    pasosAgua(40);
    afirmar(nivel(3, 0) === FLUYE(3), 'al sacar el bloque el agua no volvió a acercarse');
    P.pos.set(sx + 3.5, PY + 1.01, sz + 0.5); P.vel.set(0, 0, 0);                // parado en agua que fluye: se nada igual
    afirmar(await esperar(() => P.inWater, 2000), 'parado en agua que fluye, el jugador no está en el agua');
    P.pos.set(CX + 0.5, PY + 1.01, CZ + 4.5); P.vel.set(0, 0, 0);
    // sacar la fuente seca todo, de a un nivel por paso
    mc.setBlock(sx, PY + 1, sz, 0);
    const pasosSeco = pasosAgua(120, () => aguaAlrededor(CX, CZ, 5, PY + 1) === 0);
    afirmar(aguaAlrededor(CX, CZ, 5, PY + 1) === 0, `quedan ${aguaAlrededor(CX, CZ, 5, PY + 1)} celdas de agua después de 120 pasos`);
    return `se secó en ${pasosSeco} pasos`;
  });

  await prueba('agua que fluye: una fuente en el aire cae en cascada, se abre al llegar al suelo y se seca al sacarla', async () => {
    await arena();
    const x = CX + 9, z = CZ, g = mc.heightAt(x, z);
    afirmar(await esperar(() => mc.getBlock(x, g, z) !== 0 && mc.getBlock(x + 1, g, z) !== undefined, 5000), 'no se cargó el suelo');
    mc.setBlock(x, PY + 1, z, 10);                                              // una fuente colgada del aire
    pasosAgua(80);
    afirmar(mc.getBlock(x, PY, z) === FLUYE(1) && mc.getBlock(x, g + 2, z) === FLUYE(1) && mc.getBlock(x, g + 1, z) === FLUYE(1), 'no cae en columna hasta el suelo');
    const vecinos = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => mc.heightAt(x + dx, z + dz) <= g);
    afirmar(vecinos.some(([dx, dz]) => mc.getBlock(x + dx, g + 1, z + dz) === FLUYE(2) || mc.heightAt(x + dx, z + dz) < g), 'al llegar al suelo no se abre (nivel 2 al lado)');
    mc.setBlock(x, PY + 1, z, 0);
    const pasosSeco = pasosAgua(150, () => aguaAlrededor(x, z, 9, g + 1) === 0);
    afirmar(aguaAlrededor(x, z, 9, g + 1) === 0, `quedan ${aguaAlrededor(x, z, 9, g + 1)} celdas de agua después de 150 pasos`);
    return `se secó en ${pasosSeco} pasos`;
  });

  await prueba('agua que fluye: romper la orilla de un lago deja entrar el agua, y el agua no se pone sola donde no hay fuente', async () => {
    await arena();
    const mar = mc.CONFIG.seaLevel, lago = buscarLago();
    P.pos.set(lago.x + 0.5, mar + 6, lago.z + 0.5); P.vel.set(0, 0, 0);
    // la orilla: desde el centro del lago, la primera columna que ya no es lago (agua en la anterior, tierra en esta)
    let orilla = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let i = 1; i < 40 && !orilla; i++) {
      const x = lago.x + dx * i, z = lago.z + dz * i;
      if (mc.heightAt(x - dx, z - dz) < mar && mc.heightAt(x, z) >= mar) orilla = { x, z, ax: x - dx, az: z - dz };
    }
    afirmar(orilla, 'no se encontró la orilla del lago');
    afirmar(await esperar(() => [[orilla.x, orilla.z], [orilla.ax, orilla.az]].every(([x, z]) => mc.chunks.has(mc.chunkKey(Math.floor(x / 16), Math.floor(z / 16)))), 15000), 'no se cargaron los chunks de la orilla');
    afirmar(mc.getBlock(orilla.ax, mar, orilla.az) === 10, `junto a la orilla hay ${mc.getBlock(orilla.ax, mar, orilla.az)}, se esperaba agua`);
    const antes = mc.getBlock(orilla.x, mar, orilla.z);
    afirmar(antes !== 0 && !esAgua(antes), `la orilla es ${antes}, se esperaba un bloque`);
    afirmar(mc.getBlock(orilla.x, mar, orilla.z) === antes && !esAgua(mc.getBlock(orilla.x, mar + 1, orilla.z)), 'hay agua arriba de la orilla');
    mc.setBlock(orilla.x, mar, orilla.z, 0);                                    // se rompe: el agua del lago entra sola, con el reloj del juego
    afirmar(await esperar(() => mc.getBlock(orilla.x, mar, orilla.z) === FLUYE(1), 4000), `el hueco quedó en ${mc.getBlock(orilla.x, mar, orilla.z)}, se esperaba agua nivel 1 (20)`);
    mc.setBlock(orilla.x, mar, orilla.z, antes);                                // se tapa de nuevo: el agua que entró no queda colgada
    await dormir(600);
    afirmar(mc.getBlock(orilla.x, mar, orilla.z) === antes, 'el bloque de la orilla cambió');
    // un lago sin tocar no cambia: la superficie sigue siendo una fuente (no se convirtió en agua que fluye)
    afirmar(mc.getBlock(orilla.ax, mar, orilla.az) === 10, 'la fuente del lago cambió');
    return `orilla en (${orilla.x}, ${orilla.z})`;
  });

  // ---------------- Fase 4: mobs ----------------
  // En las pruebas los mobs no aparecen solos (arena() apaga CONFIG.mobs); se ponen a mano con mc.spawnMob
  const quietoEn = (tipo, dx, dz, dy = 0) => {                                  // un mob sobre la plataforma, sin pasear
    const m = mc.spawnMob(tipo, CX + dx + 0.5, PY + 1.01 + dy, CZ + dz + 0.5);
    m.caminando = false; m.t = 1000;
    return m;
  };
  const caminarHacia = (m, dx, dz) => { m.caminando = true; m.t = 1000; m.dirX = dx; m.dirZ = dz; m.huir = 0; };

  await prueba('mobs: caen al suelo, quedan parados sobre la plataforma y no la atraviesan aunque caigan de alto', async () => {
    await arena();
    const cerdo = quietoEn('cerdo', 0, 3, 2), zombi = quietoEn('zombi', 2, 3, 2), vaca = quietoEn('vaca', -2, 3, 2);
    afirmar(await esperar(() => cerdo.onGround && zombi.onGround && vaca.onGround, 3000), 'no aterrizaron');
    for (const m of [cerdo, zombi, vaca]) afirmar(cerca(m.pos.y, PY + 1, 0.05), `${m.tipo} quedó en y=${m.pos.y.toFixed(2)}, se esperaba ${PY + 1}`);
    const alto = mc.spawnMob('vaca', CX + 0.5, PY + 1.01, CZ + 4.5);                  // sobre el borde, y cae desde la altura maxima del mundo
    alto.pos.y = 63; alto.caminando = false; alto.t = 1000;
    afirmar(await esperar(() => alto.onGround, 3000), 'la vaca que cae de alto no aterrizó');
    afirmar(alto.pos.y > PY, `la vaca atravesó la plataforma: y=${alto.pos.y.toFixed(2)}`);
    [cerdo, zombi, vaca, alto].forEach(mc.quitarMob);
  });

  await prueba('mobs: caminan hacia donde van, miran hacia ahí y salvan un escalón de 1 bloque pero no uno de 2', async () => {
    await arena();
    const a = quietoEn('cerdo', -3, 0), x0 = a.pos.x;
    afirmar(await esperar(() => a.onGround, 2000), 'el cerdo no aterrizó');
    caminarHacia(a, 1, 0);
    await dormir(1500);
    afirmar(a.pos.x > x0 + 2, `el cerdo caminó solo ${(a.pos.x - x0).toFixed(2)} bloques en 1.5 s (esperado ~2.7)`);
    afirmar(Math.cos(a.yaw - Math.atan2(-1, 0)) > 0.98, `el cerdo mira hacia ${a.yaw.toFixed(2)} rad, debería mirar a ${Math.atan2(-1, 0).toFixed(2)} (hacia +x, módulo una vuelta)`);
    // una pared de 1 bloque de alto atravesada de lado a lado: se salta
    for (let z = CZ - 4; z <= CZ + 4; z++) mc.setBlock(CX + 1, PY + 1, z, 3);
    a.pos.set(CX - 1.5, PY + 1.01, CZ + 0.5); a.vel.set(0, 0, 0); caminarHacia(a, 1, 0);
    afirmar(await esperar(() => a.pos.x > CX + 2.2, 3000), `el cerdo no pasó un escalón de 1 bloque (x=${a.pos.x.toFixed(2)})`);
    // ...y una de 2 no
    for (let z = CZ - 4; z <= CZ + 4; z++) mc.setBlock(CX + 1, PY + 2, z, 3);
    a.pos.set(CX - 1.5, PY + 1.01, CZ + 0.5); a.vel.set(0, 0, 0); caminarHacia(a, 1, 0);
    await dormir(2500);
    afirmar(a.pos.x < CX + 1 && a.pos.y > PY, `el cerdo atravesó o saltó una pared de 2 bloques (x=${a.pos.x.toFixed(2)}, y=${a.pos.y.toFixed(2)})`);
    mc.quitarMob(a);
  });

  await prueba('mobs: el zombi persigue al jugador y le pega 3 puntos por segundo, pero no en creativo', async () => {
    await arena();
    mc.setTime(0.75);                                                          // de noche: no se quema
    const z = quietoEn('zombi', 0, -4);
    afirmar(await esperar(() => P.vida < 20, 8000), `el zombi no llegó a pegar (distancia ${Math.hypot(z.pos.x - P.pos.x, z.pos.z - P.pos.z).toFixed(1)})`);
    afirmar(P.vida === 17, `el primer golpe quitó ${20 - P.vida} puntos, se esperaban 3`);
    afirmar(await esperar(() => P.vida === 14, 2500), `el segundo golpe tardó o no llegó: vida ${P.vida}`);
    afirmar(Math.hypot(z.pos.x - P.pos.x, z.pos.z - P.pos.z) < 1.6, 'el zombi no se quedó pegado al jugador');
    mc.salud.resetear(); mc.setCreative(true);
    await dormir(2500);
    afirmar(P.vida === 20, `en creativo el zombi quitó vida: ${P.vida}`);
    mc.setCreative(false); mc.quitarMob(z); mc.setTime(0.25);
  });

  await prueba('mobs: el zombi se quema de dia si le da el sol, y con techo no', async () => {
    await arena();
    mc.setTime(0.25);
    const al_sol = quietoEn('zombi', 0, -4);
    al_sol.vida = 5;
    P.pos.set(CX + 0.5, PY + 1.01, CZ + 4.5);                                  // lejos: no lo persigue (tiene que estar a menos de 24, asi que se queda caminando hacia el jugador)
    afirmar(await esperar(() => !mc.mobs.includes(al_sol), 5000), `el zombi al sol no murió (vida ${al_sol.vida.toFixed(1)})`);
    afirmar(mc.drops.length === 0 || mc.drops.every(d => d.id !== mc.ID.LINGOTE), 'el zombi quemado soltó botín');
    for (let x = CX - 5; x <= CX + 5; x++) for (let zz = CZ - 5; zz <= CZ + 5; zz++) mc.setBlock(x, PY + 3, zz, 3);   // techo sobre toda la plataforma
    const techo = quietoEn('zombi', 0, -4);
    P.pos.set(CX + 0.5, PY + 1.01, CZ + 4.5);
    await dormir(3500);
    afirmar(mc.mobs.includes(techo) && techo.vida === 20, `el zombi bajo techo se quemó (vida ${techo.vida.toFixed(1)})`);
    mc.quitarMob(techo);
  });

  await prueba('mobs: pegarle: la mano saca 1, la espada 5 y gasta un uso; huye, un bloque en el medio lo tapa, y muerto suelta carne', async () => {
    await arena();
    const CARNE = mc.ID.CARNE, ESPADA = mc.ID.ESPADA_PIEDRA;
    const cerdo = quietoEn('cerdo', 0, -2);
    afirmar(await esperar(() => cerdo.onGround, 2000), 'el cerdo no aterrizó');
    const enFrente = () => { cerdo.pos.set(CX + 0.5, PY + 1.01, CZ - 1.8); cerdo.vel.set(0, 0, 0); cerdo.huir = 0; cerdo.caminando = false; cerdo.t = 1000; P.yaw = 0; P.pitch = -0.53; };
    const pegar = async () => { enFrente(); const antes = cerdo.vida; mc.mouse.left = true; const ok = await esperar(() => cerdo.vida !== antes, 1500); mc.mouse.left = false; return ok; };
    // con la mano
    mc.selectSlot(8);
    afirmar(await pegar(), 'el click sobre el cerdo no lo golpeó');
    afirmar(cerdo.vida === 9, `con la mano el cerdo quedó con ${cerdo.vida}, se esperaba 9`);
    afirmar(!mc.mining.active && mc.mining.p === 0, 'al golpear al cerdo también se estaba rompiendo el bloque de atrás');
    afirmar(cerdo.huir > 0 && cerdo.golpe > 0, 'el cerdo no huye ni se pone rojo al golpearlo');
    afirmar(await esperar(() => Math.hypot(cerdo.vel.x, cerdo.vel.z) > 1, 600), 'el golpe no lo empujó');
    await dormir(600);
    // un bloque en el medio lo tapa: no lo golpea (se rompe el bloque, no el cerdo)
    enFrente(); mc.setBlock(CX, PY + 2, CZ - 1, 3);
    mc.mouse.left = true; await dormir(400); mc.mouse.left = false;
    afirmar(cerdo.vida === 9, 'el golpe atravesó un bloque y llegó al cerdo');
    mc.setBlock(CX, PY + 2, CZ - 1, 0);
    // con la espada de piedra
    mc.inventory[4] = { id: ESPADA, count: 1 }; mc.selectSlot(4);
    await dormir(600);
    afirmar(await pegar(), 'la espada no golpeó al cerdo');
    afirmar(cerdo.vida === 4, `con la espada de piedra el cerdo quedó con ${cerdo.vida}, se esperaba 4`);
    afirmar(mc.inventory[4] && mc.inventory[4].dano === 1, `la espada tiene desgaste ${mc.inventory[4] && mc.inventory[4].dano}, se esperaba 1`);
    await dormir(600);
    // el golpe final lo mata: cae de costado, desaparece y suelta carne
    afirmar(await pegar(), 'el golpe final no llegó');
    afirmar(cerdo.muriendo > 0 && cerdo.vida <= 0, 'el cerdo no empezó a morir');
    afirmar(await esperar(() => !mc.mobs.includes(cerdo), 2000), 'el cerdo muerto no desapareció');
    afirmar(mc.drops.some(d => d.id === CARNE) || cuenta(CARNE) > 0, `no soltó carne: ${JSON.stringify(mc.drops.map(d => d.id))}`);
  });

  await prueba('mobs: en creativo se pueden golpear pero no sueltan nada; la carne se come', async () => {
    await arena();
    mc.setCreative(true);
    const vaca = quietoEn('vaca', 0, -2);
    afirmar(await esperar(() => vaca.onGround, 2000), 'la vaca no aterrizó');
    mc.golpearMob(vaca, 100, P.pos.x, P.pos.z);
    afirmar(await esperar(() => !mc.mobs.includes(vaca), 2000), 'la vaca no murió');
    afirmar(mc.drops.length === 0, 'en creativo la vaca soltó algo');
    mc.setCreative(false);
    mc.inventory[0] = { id: mc.ID.CARNE, count: 2 }; mc.selectSlot(0);
    P.hambre = 8; P.pitch = -1; mc.mouse.right = true;
    afirmar(await esperar(() => cuenta(mc.ID.CARNE) === 1, 2000), 'no comió la carne');
    mc.mouse.right = false;
    afirmar(P.hambre === 14, `hambre ${P.hambre}, la carne daba 6 (se esperaba 14)`);
  });

  await prueba('mobs: aparecen solos cerca del jugador (animales de dia, zombis de noche) y respetan el tope', async () => {
    await arena();
    // un lugar con cesped: el medio de un bosque o llanura
    let sitio = null;
    for (let cx = -60; cx <= 60 && !sitio; cx += 3) for (let cz = -60; cz <= 60 && !sitio; cz += 3) {
      const x = cx * 16 + 8, z = cz * 16 + 8, b = mc.biomeAt(x, z), h = mc.heightAt(x, z);
      if ((b === 0 || b === 1) && h > mc.CONFIG.seaLevel + 3 && h < 44 && [[-3, 0], [3, 0], [0, -3], [0, 3]].every(([dx, dz]) => mc.biomeAt(x + dx * 16, z + dz * 16) === b)) sitio = { x, z, h };
    }
    afirmar(sitio, 'no se encontró un lugar con césped');
    P.pos.set(sitio.x + 0.5, sitio.h + 3, sitio.z + 0.5); P.vel.set(0, 0, 0); P.fallMax = P.lastY = P.pos.y;
    afirmar(await esperar(() => [...mc.chunks.values()].filter(c => c.meshed).length > 120, 25000), 'no se cargaron los chunks de alrededor');
    mc.mobs.slice().forEach(mc.quitarMob);
    mc.CONFIG.mobs = true; mc.CONFIG.maxMobs = 12; mc.setTime(0.25);
    afirmar(await esperar(() => mc.mobs.some(m => m.def.pasivo), 20000), 'de día no apareció ni un cerdo o vaca en 20 s');
    afirmar(mc.mobs.every(m => !m.def.hostil), 'de día apareció un zombi');
    const [cerdo] = mc.mobs;
    const d = Math.hypot(cerdo.pos.x - P.pos.x, cerdo.pos.z - P.pos.z);
    afirmar(d > 10 && d < 60, `el animal apareció a ${d.toFixed(1)} bloques del jugador (esperado entre 18 y 44)`);
    mc.setTime(0.75);                                                          // de noche
    afirmar(await esperar(() => mc.mobs.some(m => m.def.hostil), 20000), 'de noche no apareció ni un zombi en 20 s');
    mc.CONFIG.maxMobs = 3; mc.mobs.slice().forEach(mc.quitarMob);
    await dormir(8000);
    afirmar(mc.mobs.length <= 3, `hay ${mc.mobs.length} mobs, el tope era 3`);
    mc.CONFIG.mobs = false; mc.mobs.slice().forEach(mc.quitarMob); mc.CONFIG.maxMobs = 12; mc.setTime(0.25);
    return `${sitio.x},${sitio.z}`;
  });

  // Un lugar en el medio de un bioma (los 4 puntos a 48 bloques tambien son de ese bioma), en tierra firme y por debajo de la linea de nieve
  const sitioDeBioma = bioma => {
    for (let cx = -60; cx <= 60; cx += 3) for (let cz = -60; cz <= 60; cz += 3) {
      const x = cx * 16 + 8, z = cz * 16 + 8, h = mc.heightAt(x, z);
      if (mc.biomeAt(x, z) === bioma && h > mc.CONFIG.seaLevel + 3 && h < 44 && [[-3, 0], [3, 0], [0, -3], [0, 3]].every(([dx, dz]) => mc.biomeAt(x + dx * 16, z + dz * 16) === bioma)) return { x, z, h };
    }
    return null;
  };

  await prueba('mobs: tambien aparecen animales en el desierto (sobre arena) y en el nevado (sobre nieve)', async () => {
    await arena();
    const detalle = [];
    for (const [bioma, nombre, suelos] of [[2, 'desierto', [6]], [3, 'nevado', [mc.ID.NIEVE]]]) {
      const sitio = sitioDeBioma(bioma);
      afirmar(sitio, `no se encontró un lugar del bioma ${nombre}`);
      mc.CONFIG.mobs = false; mc.mobs.slice().forEach(mc.quitarMob);
      P.pos.set(sitio.x + 0.5, sitio.h + 3, sitio.z + 0.5); P.vel.set(0, 0, 0); P.fallMax = P.lastY = P.pos.y;
      afirmar(await esperar(() => [...mc.chunks.values()].filter(c => c.meshed).length > 120, 25000), `no se cargaron los chunks del ${nombre}`);
      mc.CONFIG.maxMobs = 12; mc.setTime(0.25); mc.CONFIG.mobs = true;
      afirmar(await esperar(() => mc.mobs.some(m => m.def.pasivo), 20000), `en el ${nombre} no apareció ni un animal en 20 s`);
      const animal = mc.mobs.find(m => m.def.pasivo);
      const suelo = mc.getBlock(Math.floor(animal.pos.x), Math.floor(animal.pos.y - 0.5), Math.floor(animal.pos.z));
      afirmar(suelos.includes(suelo), `el animal del ${nombre} está sobre el bloque ${suelo}, se esperaba ${suelos.join(' o ')}`);
      detalle.push(`${nombre}: ${animal.tipo} sobre ${suelo}`);
    }
    mc.CONFIG.mobs = false; mc.mobs.slice().forEach(mc.quitarMob);
    return detalle.join(', ');
  });

  await prueba('mobs: el cartel de muerte dice quién te mató: "un zombi" o el nombre del mob de un mod', async () => {
    await arena();
    mc.setTime(0.75);                                                          // de noche: el zombi no se quema
    P.vida = 2;
    const zombi = quietoEn('zombi', 0, -3);
    afirmar(await esperar(() => P.muerto, 8000), 'el zombi no mató al jugador');
    afirmar(el('muerteCausa').textContent === 'Te mató un zombi', `el cartel dice "${el('muerteCausa').textContent}"`);
    mc.quitarMob(zombi); mc.salud.resetear();
    mc.TIPOS.golemprueba = { ...mc.TIPOS.zombi, nombre: 'Golem de prueba', mod: true };   // un hostil de mod: otra clave, otro nombre
    P.vida = 2;
    const golem = quietoEn('golemprueba', 0, -3);
    const murio = await esperar(() => P.muerto, 8000);
    const texto = el('muerteCausa').textContent;
    mc.quitarMob(golem); delete mc.TIPOS.golemprueba; mc.salud.resetear(); mc.setTime(0.25);
    afirmar(murio, 'el mob del mod no mató al jugador');
    afirmar(texto === 'Te mató: Golem de prueba', `el cartel dice "${texto}", se esperaba el nombre del mob del mod`);
  });

  await prueba('mobs: cada mob se dibuja con 5 mallas y los del mismo tipo comparten la geometria (poco costo por cuadro)', async () => {
    await arena();
    const mallas = g => { let n = 0; g.traverse(o => { if (o.isMesh) n++; }); return n; };
    for (const tipo of ['cerdo', 'vaca', 'zombi']) {
      const a = quietoEn(tipo, -1, 3), b = quietoEn(tipo, 1, 3);
      afirmar(mallas(a.grupo) === 5, `el ${tipo} tiene ${mallas(a.grupo)} mallas, se esperaban 5 (cuerpo y 4 miembros)`);
      afirmar(a.grupo.children[0].geometry === b.grupo.children[0].geometry, `dos ${tipo}s no comparten la geometria del cuerpo`);
      afirmar(a.mat !== b.mat, 'los dos comparten el material: el destello rojo les pegaria a los dos');
      mc.quitarMob(a); mc.quitarMob(b);
    }
  });

  // ---------------- inventario ----------------
  await prueba('inventario: abrir, mover, mitad, Shift+click, teclas 1-9 y cerrar', async () => {
    await arena();
    const inv = mc.inventory;
    tecla('KeyE');
    afirmar(el('inventory').style.display === 'flex' && el('hotbar').style.display === 'none', 'E no abrio el inventario');
    const grillas = document.querySelectorAll('#invPanel .grid'), mochila = grillas[1].children, barra = grillas[2].children;
    clic(barra[0]); clic(mochila[0]);                                          // click: agarrar y soltar
    afirmar(inv[0] === null && inv[9] && inv[9].count === 16, 'mover una pila no anduvo');
    clic(mochila[0], 2); clic(mochila[1]);                                     // click derecho: mitad
    afirmar(inv[9].count === 8 && inv[10] && inv[10].count === 8, 'click derecho no partio la pila a la mitad');
    clic(mochila[0], 0, true);                                                 // Shift+click: mochila -> barra
    afirmar(inv[0] && inv[0].id === 7 && inv[0].count === 8 && inv[9] === null, 'Shift+click no la paso a la barra');
    mochila[1].dispatchEvent(new MouseEvent('mouseenter'));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit5', bubbles: true }));
    afirmar(inv[4] && inv[4].count === 8 && inv[10] === null, 'la tecla 5 sobre un espacio no lo mando a la barra');
    clic(barra[1]);                                                            // agarrar y cerrar con algo en la mano
    tecla('KeyE');
    const total = inv.reduce((n, s) => n + (s ? s.count : 0), 0);
    afirmar(total === 32, `al cerrar quedaron ${total} items, se esperaban 32`);
    afirmar(document.querySelector('.cursorItem').style.display === 'none', 'quedo algo pegado al cursor');
  });

  await prueba('inventario lleno devuelve el sobrante', async () => {
    await arena();
    mc.inventory.fill(null);
    const sobra = mc.invAdd(2, 36 * 64 + 10);
    afirmar(sobra === 10, `sobraron ${sobra}, se esperaban 10`);
    mc.inventory.fill(null);
  });

  await prueba('tirar un objeto con click afuera del panel y rueda del mouse', async () => {
    await arena();
    tecla('KeyE');
    const barra = document.querySelectorAll('#invPanel .grid')[2].children;
    clic(barra[0]);                                                            // agarra 16 tablones
    const antesDrops = mc.drops.length;
    clic(el('inventory'), 2);                                                  // click derecho fuera del panel: tira 1
    afirmar(mc.drops.length === antesDrops + 1, 'no aparecio el objeto tirado');
    afirmar(document.querySelector('.cursorItem .count').textContent === '15', 'el cursor no quedo con 15');
    tecla('KeyE');
    mc.selectSlot(0);
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
    const sel = [...document.querySelectorAll('#hotbar .slot')].findIndex(s => s.classList.contains('sel'));
    afirmar(sel === 1, `la rueda dejo la ranura ${sel + 1}, se esperaba la 2`);
  });

  // ---------------- cielo y calidad ----------------
  await prueba('en creativo la hora avanza con T y de noche oscurece', async () => {
    await arena();
    mc.setCreative(true);                                                     // T solo anda en creativo
    const minutos = () => { const m = el('info').textContent.match(/Hora (\d\d):(\d\d)/); return +m[1] * 60 + +m[2]; };
    await dormir(600); const antes = minutos();
    tecla('KeyT'); await dormir(700);
    const dif = (minutos() - antes + 1440) % 1440;
    afirmar(dif >= 175 && dif <= 190, `T avanzo ${dif} min (antes ${antes}, despues ${minutos()}, aviso "${el('toast').textContent}")), se esperaban ~180`);
    mc.setTime(0.7); await dormir(700);
    const c = mc.scene.fog.color;
    afirmar(c.r + c.g + c.b < 0.3 && mc.sun.intensity < 0.3, `de noche la niebla suma ${(c.r + c.g + c.b).toFixed(2)} y la luz ${mc.sun.intensity.toFixed(2)}`);
    mc.setTime(0.25); await dormir(700);
    afirmar(mc.sun.intensity > 0.6, `de dia la luz es ${mc.sun.intensity.toFixed(2)}`);
  });

  await prueba('la calidad (K) cambia distancia de vista y niebla', async () => {
    await arena();
    const estado = () => `${mc.CONFIG.quality}/${mc.CONFIG.renderDistance}/${Math.round(mc.scene.fog.far)}`;
    tecla('KeyK'); await dormir(300);
    afirmar(estado() === 'baja/4/48', `en baja: ${estado()}`);
    afirmar(await esperar(() => mc.chunks.size <= 169, 5000), `en baja quedaron ${mc.chunks.size} chunks, se esperaban 169 o menos`);
    tecla('KeyK'); await dormir(300);
    afirmar(estado() === 'alta/6/80', `en alta: ${estado()}`);
    tecla('KeyK'); await dormir(300);
    afirmar(estado() === 'media/6/80', `en media: ${estado()}`);
    afirmar(await esperar(() => mc.chunks.size >= 225, 15000), `al volver a media hay ${mc.chunks.size} chunks, se esperaban 225`);
  });

  // ---------------- salud ----------------
  await prueba('salud: una caida de 8 bloques quita 5 de vida y una de 3 no duele', async () => {
    await arena();
    P.pos.set(CX + 0.5, PY + 4, CZ + 0.5); P.vel.set(0, 0, 0); P.onGround = false;       // 3 bloques sobre el piso
    afirmar(await esperar(() => P.onGround && P.pos.y < PY + 2, 3000), 'no aterrizo (3 bloques)');
    await dormir(200);
    afirmar(P.vida === 20, `3 bloques quitaron ${20 - P.vida} de vida`);
    P.pos.set(CX + 0.5, PY + 9, CZ + 0.5); P.vel.set(0, 0, 0); P.onGround = false;       // 8 bloques sobre el piso
    afirmar(await esperar(() => P.onGround && P.pos.y < PY + 2, 4000), 'no aterrizo (8 bloques)');
    await dormir(200);
    afirmar(P.vida === 15, `8 bloques dejaron la vida en ${P.vida}, se esperaba 15`);
    return 'vida 20 → 15';
  });

  await prueba('salud: en creativo no hay daño y la barra se oculta', async () => {
    await arena();
    mc.setCreative(true);
    afirmar(mc.salud.danar(5) === false && P.vida === 20, 'el daño paso en creativo');
    await dormir(100);
    afirmar(el('estado').style.display === 'none', 'la barra se ve en creativo');
    mc.setCreative(false); await dormir(100);
    afirmar(el('estado').style.display === 'flex', 'la barra no vuelve en supervivencia');
  });

  await prueba('salud: la barra muestra corazones y muslos llenos, medios y vacios', async () => {
    await arena();
    P.vida = 7; P.hambre = 13; mc.salud.actualizar(0);
    const fuentes = id => [...document.querySelectorAll(`#${id} img`)].map(i => i.src);
    const c = fuentes('corazones'), h = fuentes('hambre');
    afirmar(c.length === 10 && h.length === 10, 'no hay 10 corazones y 10 muslos');
    afirmar(c[0] === c[2] && c[3] !== c[0] && c[4] === c[9] && c[4] !== c[3] && c[4] !== c[0], 'la vida 7 no se ve como 3 llenos, 1 medio y 6 vacios');
    afirmar(h[0] === h[5] && h[6] !== h[0] && h[7] === h[9] && h[7] !== h[6] && h[7] !== h[0], 'el hambre 13 no se ve como 6 llenos, 1 medio y 3 vacios');
  });

  await prueba('salud: correr y saltar dan hambre, caminar no', async () => {
    await arena();
    await apretar('KeyW', 500);
    afirmar(P.agotamiento === 0, `caminar dio ${P.agotamiento} de agotamiento`);
    await arena();
    tecla('ShiftLeft'); await apretar('KeyW', 500); tecla('ShiftLeft', false);
    afirmar(P.agotamiento > 0.15, `correr dio solo ${P.agotamiento.toFixed(2)}`);
    const antes = P.agotamiento;
    await apretar('Space', 150);
    afirmar(P.agotamiento >= antes + 0.04, `saltar sumo ${(P.agotamiento - antes).toFixed(3)}, se esperaba 0.05`);
  });

  await prueba('salud: el agotamiento gasta saturacion y despues hambre; con hambre llena regenera; sin comida baja a 1 y no mata', async () => {
    await arena();
    P.saturacion = 1; P.hambre = 20; P.agotamiento = 4.5; mc.salud.actualizar(0.01);
    afirmar(P.saturacion === 0 && P.hambre === 20, `con saturacion: saturacion=${P.saturacion} hambre=${P.hambre}`);
    P.agotamiento = 4; mc.salud.actualizar(0.01);
    afirmar(P.hambre === 19, `sin saturacion: hambre=${P.hambre}, se esperaba 19`);
    P.vida = 10; P.hambre = 20; P.agotamiento = 0; mc.salud.actualizar(4.1);
    afirmar(P.vida === 11, `regeneracion: vida=${P.vida}, se esperaba 11`);
    P.vida = 5; P.hambre = 0; P.saturacion = 0; P.agotamiento = 0; mc.salud.actualizar(4.1);
    afirmar(P.vida === 4, `inanicion: vida=${P.vida}, se esperaba 4`);
    await dormir(600);                                                                     // pasa la invulnerabilidad de 0.5 s
    P.vida = 1; mc.salud.actualizar(4.1);
    afirmar(P.vida === 1 && !P.muerto, `la inanicion mato o bajo de 1 (vida=${P.vida})`);
  });

  await prueba('salud: comer una manzana llena hambre solo si hay hambre y no se pone como bloque', async () => {
    await arena();
    mc.inventory[0] = { id: 100, count: 3 }; mc.selectSlot(0);
    P.pitch = -1;                                                                          // mira al piso, donde se pondria un bloque
    P.hambre = 20; mc.mouse.right = true; await dormir(500); mc.mouse.right = false;
    afirmar(cuenta(100) === 3, 'comio con el hambre llena');
    afirmar(mc.getBlock(CX, PY + 1, CZ - 1) === 0, 'puso la manzana como si fuera un bloque');
    P.hambre = 10; mc.mouse.right = true;
    afirmar(await esperar(() => cuenta(100) === 2, 2000), 'no comio teniendo hambre');
    mc.mouse.right = false;
    afirmar(P.hambre === 14, `hambre ${P.hambre}, se esperaba 14`);
  });

  await prueba('salud: las hojas pueden soltar una manzana', async () => {
    await arena();
    const azar = Math.random; Math.random = () => 0;                                       // con 0 siempre "sale" la manzana
    try {
      mc.setBlock(CX, PY + 2, CZ - 1, 5);                                                  // hojas a la altura de los ojos
      mc.mouse.left = true;
      afirmar(await esperar(() => mc.getBlock(CX, PY + 2, CZ - 1) === 0, 4000), 'no se rompieron las hojas');
    } finally { Math.random = azar; mc.mouse.left = false; }
    const ids = mc.drops.map(d => d.id);
    afirmar(ids.includes(100), `no solto manzana (soltó: ${ids.join(',') || 'nada'})`);
    afirmar(ids.includes(5), 'no solto las hojas');
  });

  await prueba('salud: morir muestra el cartel, conserva el inventario y reaparece en el inicio', async () => {
    await arena();
    mc.inventory[5] = { id: 4, count: 9 };
    afirmar(mc.salud.danar(25, 'caida') === true, 'no recibio el daño');
    afirmar(P.muerto && P.vida === 0, 'no murio');
    afirmar(el('muerte').style.display === 'flex', 'no aparecio el cartel de muerte');
    afirmar(/caíste/.test(el('muerteCausa').textContent), `el cartel dice "${el('muerteCausa').textContent}"`);
    el('reaparecerBtn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    afirmar(!P.muerto && P.vida === 20 && P.hambre === 20 && el('muerte').style.display === 'none', 'no reaparecio con la salud completa');
    afirmar(cuenta(4) === 9 && cuenta(7) === 16, 'se perdio el inventario');
    const s = P.spawn;
    afirmar(await esperar(() => cerca(P.pos.x, s.x, 0.6) && cerca(P.pos.z, s.z, 0.6), 3000), `no volvio al inicio (${P.pos.x.toFixed(1)}, ${P.pos.z.toFixed(1)})`);
    afirmar(await esperar(() => P.onGround, 15000), 'no quedo apoyado en el inicio');
    afirmar(P.vida === 20, `perdio vida al reaparecer: ${P.vida}`);
  });

  // ---------------- agua y persistencia (viajan lejos: van al final) ----------------
  await prueba('nadar: pantalla azul bajo el agua y subir con Espacio', async () => {
    await arena();
    const mar = mc.CONFIG.seaLevel, lago = buscarLago();
    P.pos.set(lago.x + 0.5, mar + 4, lago.z + 0.5); P.vel.set(0, 0, 0);
    afirmar(await esperar(() => P.inWater, 15000), 'el jugador no entro al agua');
    afirmar(await esperar(() => el('water').style.display === 'block', 5000), 'no aparecio la pantalla azul bajo el agua');
    const y0 = P.pos.y;
    await apretar('Space', 1500);
    afirmar(P.pos.y > y0 + 0.5, `subio solo ${(P.pos.y - y0).toFixed(2)} bloques`);
    return `lago en (${lago.x}, ${lago.z})`;
  });

  await prueba('salud: caer al agua desde 10 bloques no duele', async () => {
    await arena();
    const mar = mc.CONFIG.seaLevel, lago = buscarLago();
    P.pos.set(lago.x + 0.5, mar + 10, lago.z + 0.5); P.vel.set(0, 0, 0); P.fallMax = P.lastY = P.pos.y;
    afirmar(await esperar(() => P.inWater, 15000), 'el jugador no entro al agua');
    await dormir(1500);                                                        // se asienta en el fondo
    afirmar(P.vida === 20, `la vida es ${P.vida}: el agua no amortiguo la caida`);
  });

  await prueba('lo construido se conserva al alejarse y volver', async () => {
    await arena();
    mc.setBlock(CX + 4, PY, CZ + 4, 0);                                        // un hoyo en la plataforma
    for (let y = PY + 1; y <= PY + 3; y++) mc.setBlock(CX + 3, y, CZ - 4, 8);  // y una torre (el mundo termina en y=63)
    P.pos.set(CX + 240.5, mc.heightAt(CX + 240, CZ) + 3, CZ + 0.5); P.vel.set(0, 0, 0);
    afirmar(await esperar(() => !mc.chunks.has(claveArena), 10000), 'el chunk lejano no se descargo');
    afirmar(mc.savedChunks.has(claveArena), 'el chunk modificado no se guardo en savedChunks');
    P.pos.set(CX + 0.5, PY + 2, CZ + 0.5); P.vel.set(0, 0, 0);
    afirmar(await esperar(arenaLista, 15000), 'el chunk no volvio a cargarse');
    afirmar(mc.getBlock(CX + 3, PY + 3, CZ - 4) === 8, 'la torre desaparecio');
    afirmar(mc.getBlock(CX + 4, PY, CZ + 4) === 0, 'el hoyo desaparecio');
    return `${mc.savedChunks.size} chunk(s) guardados`;
  });

  // ---------------- guardado en disco ----------------
  // Tiene que ser la ULTIMA: deja un estado conocido guardado y test/run.js reinicia el juego para comprobarlo
  // con test/pruebas-reinicio.js. Si cambias algo de aca, cambia lo mismo alla.
  await prueba('guardar: escribe el mundo, el inventario, el modo, la hora y la posicion', async () => {
    await arena();
    mc.setBlock(CX + 4, PY, CZ + 4, 0);                                        // hoyo en la plataforma
    for (let y = PY + 1; y <= PY + 3; y++) mc.setBlock(CX + 3, y, CZ - 4, 8);  // torre
    mc.inventory[3] = { id: 2, count: 33 }; mc.inventory[12] = { id: 5, count: 7 };
    mc.inventory[20] = { id: mc.ID.PICO_PIEDRA, count: 1, dano: 7 };           // una herramienta con desgaste
    mc.selectSlot(3);
    mc.setCreative(true);
    mc.setTime(0.6);
    P.yaw = 1.2; P.pitch = -0.3;
    P.vida = 13; P.hambre = 7; P.saturacion = 2;                               // en creativo los valores se conservan
    afirmar(await mc.guardarAhora(), 'guardarAhora fallo (¿no hay window.guardado?)');
    afirmar(mc.mundoId === 'prueba', `el mundo de las pruebas es "${mc.mundoId}"`);
    const e = await window.guardado.cargar(mc.mundoId);                        // se vuelve a leer lo que quedo en el disco
    afirmar(e && e.version === 1, 'no se pudo volver a leer el archivo guardado');
    afirmar(e.semilla === 1337 && e.creativo === true && e.seleccionado === 3, 'semilla, modo o ranura mal guardados');
    afirmar(e.vida === 13 && e.hambre === 7 && e.saturacion === 2, `salud mal guardada: ${e.vida}/${e.hambre}/${e.saturacion}`);
    afirmar(e.spawn && Number.isFinite(e.spawn.x) && Number.isFinite(e.spawn.y), 'no se guardo el punto de aparicion');
    afirmar(e.nombre === 'Mundo de prueba', `el nombre guardado es "${e.nombre}"`);
    afirmar(e.inventario[3] && e.inventario[3].count === 33, 'el inventario no se guardo');
    afirmar(e.inventario[20] && e.inventario[20].dano === 7, `el desgaste de la herramienta no se guardo: ${JSON.stringify(e.inventario[20])}`);
    afirmar(e.itemsV === 2, `falta la marca itemsV (vale ${e.itemsV})`);
    const c = e.chunks.find(c => c.cx === Math.floor(CX / 16) && c.cz === Math.floor(CZ / 16));
    afirmar(c, 'el chunk de la plataforma no esta en el archivo');
    afirmar(c.data instanceof Uint8Array && c.data.length === 16 * 64 * 16, 'los datos del chunk no son un Uint8Array de 16384 bytes');
    afirmar(c.data[(PY + 3) * 256 + ((CZ - 4) & 15) * 16 + ((CX + 3) & 15)] === 8, 'la torre no esta en los datos guardados');
    return `${e.chunks.length} chunk(s) modificados en el archivo`;
  });

  return resultados;
}
