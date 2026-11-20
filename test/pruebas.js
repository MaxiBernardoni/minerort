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

  await prueba('vuela con F y vuelve a caminar', async () => {
    await arena();
    const y0 = P.pos.y;
    tecla('KeyF'); afirmar(P.fly, 'F no activo el vuelo');
    await apretar('Space', 600);
    afirmar(P.pos.y - y0 > 2, `subio solo ${(P.pos.y - y0).toFixed(1)} bloques`);
    tecla('KeyF'); afirmar(!P.fly, 'F no desactivo el vuelo');
    return `subio ${(P.pos.y - y0).toFixed(1)} bloques`;
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
  await prueba('rompe piedra (~1 s), suelta adoquin y lo recoge', async () => {
    await arena();
    mc.setBlock(CX, PY + 2, CZ - 1, 3);                                       // a la altura de los ojos, 1 bloque adelante
    const antes = cuenta(9);
    mc.mouse.left = true; const t0 = performance.now();
    const rompio = await esperar(() => mc.getBlock(CX, PY + 2, CZ - 1) === 0, 5000);
    const seg = (performance.now() - t0) / 1000;
    mc.mouse.left = false;
    afirmar(rompio, 'no se rompio en 5 s');
    afirmar(seg > 0.7 && seg < 2, `tardo ${seg.toFixed(2)} s (esperado ~1.1)`);
    afirmar(await esperar(() => cuenta(9) === antes + 1, 4000), 'el adoquin no llego al inventario');
    return `${seg.toFixed(2)} s, +1 adoquin`;
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
  await prueba('la hora avanza con T y de noche oscurece', async () => {
    await arena();
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
    mc.inventory[0] = { id: 11, count: 3 }; mc.selectSlot(0);
    P.pitch = -1;                                                                          // mira al piso, donde se pondria un bloque
    P.hambre = 20; mc.mouse.right = true; await dormir(500); mc.mouse.right = false;
    afirmar(cuenta(11) === 3, 'comio con el hambre llena');
    afirmar(mc.getBlock(CX, PY + 1, CZ - 1) === 0, 'puso la manzana como si fuera un bloque');
    P.hambre = 10; mc.mouse.right = true;
    afirmar(await esperar(() => cuenta(11) === 2, 2000), 'no comio teniendo hambre');
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
    afirmar(ids.includes(11), `no solto manzana (soltó: ${ids.join(',') || 'nada'})`);
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
    const c = e.chunks.find(c => c.cx === Math.floor(CX / 16) && c.cz === Math.floor(CZ / 16));
    afirmar(c, 'el chunk de la plataforma no esta en el archivo');
    afirmar(c.data instanceof Uint8Array && c.data.length === 16 * 64 * 16, 'los datos del chunk no son un Uint8Array de 16384 bytes');
    afirmar(c.data[(PY + 3) * 256 + ((CZ - 4) & 15) * 16 + ((CX + 3) & 15)] === 8, 'la torre no esta en los datos guardados');
    return `${e.chunks.length} chunk(s) modificados en el archivo`;
  });

  return resultados;
}
