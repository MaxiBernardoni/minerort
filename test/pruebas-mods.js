// ============================================================
// pruebas-mods.js - Los mods (Fase 6). Las llama test/run.js despues de dejar mods en la carpeta de mods de las pruebas
// (base/mods) y de abrir o reabrir el mundo "mods". Usa el mod de ejemplo mods-ejemplo/rubi.
//   modo 'cargado':  mods instalados: se registran bloques, objetos, receta, mob, generacion y eventos; los rotos no frenan nada
//   modo 'faltante': se borro el mod del ejemplo: el mundo carga igual, con marcadores "desconocido" que conservan los ids
//   modo 'vuelto':   el mod vuelve (y hay otro mod que se carga ANTES): los ids siguen siendo los mismos
//   modo 'menu':     el menu principal lista los mods y los que tienen errores
// ============================================================
async (modo) => {
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const esperar = async (cond, ms = 5000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (cond()) return true; await dormir(20); } return !!cond(); };
  const afirmar = (cond, msg) => { if (!cond) throw new Error(msg); };
  const el = id => document.getElementById(id);
  const CX = 72, CZ = 40, PY = 60;
  const etiqueta = { cargado: 'mods', faltante: 'mod que falta', vuelto: 'mod que vuelve', menu: 'menu de mods' }[modo];
  const resultados = [];
  const prueba = async (nombre, fn) => {
    try { resultados.push({ nombre: `${etiqueta}: ${nombre}`, ok: true, detalle: (await fn()) || '' }); }
    catch (e) { resultados.push({ nombre: `${etiqueta}: ${nombre}`, ok: false, detalle: (e && e.message) || String(e) }); }
  };
  const tabla = () => mc.mods.estado().tabla;
  const nombre = id => (mc.BLOCKS[id] || mc.ITEMS[id] || {}).name;

  if (modo === 'menu') {
    await dormir(800);
    await prueba('el menu lista los mods instalados y los que tienen errores', async () => {
      const t = el('menuModsTexto').textContent;
      afirmar(t.includes('Rubíes 1.0.0'), `no aparece el mod instalado: "${t}"`);
      afirmar(t.includes('mala-api') && t.includes('API 99'), `no aparece el error del mod de otra API: "${t}"`);
      afirmar(t.includes('sin-manifiesto') && t.includes('falta mod.json'), `no aparece la carpeta sin manifiesto: "${t}"`);
      afirmar(el('modsBtn').style.display !== 'none', 'no se ve el boton de abrir la carpeta de mods');
    });
    return resultados;
  }

  await dormir(500);
  const P = mc.player;
  const claveArena = mc.chunkKey(Math.floor(CX / 16), Math.floor(CZ / 16));
  async function arena() {
    mc.CONFIG.mobs = false; mc.mobs.slice().forEach(mc.quitarMob);
    mc.setLocked(true); el('overlay').style.display = 'none';
    P.fly = false; P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = 0; P.pos.set(CX + 0.5, PY + 1.01, CZ + 0.5);
    afirmar(await esperar(() => { const c = mc.chunks.get(claveArena); return !!(c && c.meshed); }, 15000), 'el chunk de la plataforma no se cargo');
    for (let x = CX - 5; x <= CX + 5; x++) for (let z = CZ - 5; z <= CZ + 5; z++) { mc.setBlock(x, PY, z, 3); for (let y = PY + 1; y <= PY + 3; y++) if (mc.getBlock(x, y, z) !== 0) mc.setBlock(x, y, z, 0); }
    mc.setCreative(false); mc.salud.resetear(); mc.inventory.fill(null);
    while (mc.drops.length) { const d = mc.drops.pop(); mc.scene.remove(d.mesh); }
    mc.setTime(0.25); P.pos.set(CX + 0.5, PY + 1.01, CZ + 0.5); P.vel.set(0, 0, 0); P.fallMax = P.lastY = P.pos.y;
    afirmar(await esperar(() => P.onGround, 3000), 'el jugador no quedo apoyado');
  }

  if (modo === 'cargado') {
    await prueba('el mod de ejemplo se carga y los rotos (con error, de otra API, sin manifiesto, "main" afuera, registro doble) no frenan nada', async () => {
      const { cargados, fallidos } = mc.mods.cargados();
      afirmar(cargados.some(m => m.id === 'rubi' && m.version === '1.0.0'), `no se cargo el mod rubi: ${JSON.stringify(cargados)}`);
      const ids = fallidos.map(f => f.id).sort().join(',');
      afirmar(ids === 'escapa,mala-api,roto,sin-manifiesto,zzz-dup', `fallidos: ${ids}`);
      afirmar(fallidos.find(f => f.id === 'escapa').error.includes('dentro de la carpeta'), 'un "main" fuera de la carpeta del mod no se rechazo');
      afirmar(fallidos.find(f => f.id === 'zzz-dup').error.includes('ya esta registrado'), 'registrar dos veces lo mismo no dio error');
      afirmar(fallidos.find(f => f.id === 'roto').error.includes('a proposito'), 'el error del mod roto no es el que lanzo');
      afirmar(fallidos.find(f => f.id === 'mala-api').error.includes('API 99'), 'el mod de otra API no explica por que se rechazo');
      afirmar(mc.chunks.size >= 100, 'el juego no genero el mundo');
      return `${cargados.length} cargado, ${fallidos.length} con errores`;
    });

    await prueba('registra un bloque, dos objetos y una receta con ids propios y estables', async () => {
      const t = tabla();
      afirmar(t.bloques['rubi:mineral'] === 30, `rubi:mineral es ${t.bloques['rubi:mineral']}, se esperaba 30 (el primer id libre de mods)`);
      afirmar(t.objetos['rubi:rubi'] === 200 && t.objetos['rubi:pico'] === 201, `objetos: ${JSON.stringify(t.objetos)}`);
      const b = mc.BLOCKS[30], rubi = mc.ITEMS[200], pico = mc.ITEMS[201];
      afirmar(b.name === 'Mineral de rubí' && b.nivel === 2 && b.necesita && b.drop === 200 && b.herramienta === 'pico', `bloque mal definido: ${JSON.stringify(b)}`);
      afirmar(b.tiles.every(t => t >= 20 && t < 63), `el bloque no tiene un tile propio: ${b.tiles}`);
      afirmar(rubi.name === 'Rubí' && pico.tool === 'pico' && pico.nivel === 3 && pico.dur === 1800, `objetos mal definidos: ${JSON.stringify([rubi, pico])}`);
      afirmar(mc.itemSprites[200] && mc.itemSprites[201], 'faltan los sprites');
      const r = mc.buscarReceta([200, 200, 200, 0, mc.ID.PALO, 0, 0, mc.ID.PALO, 0], 3);
      afirmar(r && r.id === 201 && r.count === 1, `la receta del pico de rubi da ${JSON.stringify(r)}`);
      afirmar(mc.maxPila(201) === 1 && mc.maxPila(200) === 64, 'el pico no es una herramienta (no se apila)');
    });

    await prueba('el catalogo creativo muestra lo del mod y la busqueda lo encuentra', async () => {
      await arena();
      mc.setCreative(true); mc.openInventory();
      const grilla = [...document.querySelectorAll('#invPanel .grid')][0];
      const b = el('catalogBuscar'); b.value = 'rubi'; b.dispatchEvent(new Event('input'));
      const visibles = [...grilla.children].filter(c => c.style.display !== 'none').length;
      b.value = ''; b.dispatchEvent(new Event('input')); mc.closeInventory(); mc.setCreative(false);
      afirmar(visibles === 3, `buscar "rubi" muestra ${visibles}, se esperaban 3 (mineral, rubi y pico)`);
    });

    await prueba('la generacion agrega vetas de rubi solo en lo profundo, reemplazando piedra, siempre iguales', async () => {
      let total = 0, ymax = 0, chunksConVeta = 0;
      for (let dx = 0; dx < 8; dx++) for (let dz = 0; dz < 8; dz++) {
        const d = mc.generateChunk(60 + dx, 60 + dz).data; let n = 0;
        for (let i = 0; i < d.length; i++) if (d[i] === 30) { n++; ymax = Math.max(ymax, i >> 8); }
        total += n; if (n) chunksConVeta++;
      }
      afirmar(total > 30, `solo ${total} bloques de rubi en 64 chunks`);
      afirmar(chunksConVeta > 15 && chunksConVeta < 60, `${chunksConVeta} de 64 chunks tienen veta (se esperaba ~60%)`);
      afirmar(ymax <= 23, `hay rubi a y=${ymax} (el mod solo lo pone hasta y=20 mas la veta)`);
      const a = mc.generateChunk(61, 61).data, b = mc.generateChunk(61, 61).data;
      afirmar(a.every((v, i) => v === b[i]), 'el mismo chunk generado dos veces da distinto');
      return `${total} bloques en ${chunksConVeta} chunks`;
    });

    await prueba('romper el mineral: sin pico de hierro no suelta; con el pico de rubi suelta un rubi, y el mod se entera (evento)', async () => {
      await arena();
      const romper = async () => { mc.setBlock(CX, PY + 2, CZ - 1, 30); mc.mouse.left = true; const ok = await esperar(() => mc.getBlock(CX, PY + 2, CZ - 1) === 0, 8000); mc.mouse.left = false; afirmar(ok, 'no se rompio en 8 s'); };
      const cuenta = id => mc.inventory.reduce((n, s) => n + (s && s.id === id ? s.count : 0), 0);
      mc.inventory[4] = { id: mc.ID.PICO_PIEDRA, count: 1 }; mc.selectSlot(4);
      await romper(); await dormir(1200);
      afirmar(cuenta(200) === 0 && mc.drops.length === 0, 'el mineral solto algo con un pico de piedra (pide nivel 2)');
      afirmar(el('toast').textContent.includes('mineral de rubí'), 'el mod no se entero de que se rompio (evento bloque-roto)');
      el('toast').textContent = '';
      mc.inventory[4] = { id: 201, count: 1 }; mc.selectSlot(4);
      await romper();
      afirmar(await esperar(() => cuenta(200) === 1, 4000), 'el pico de rubi no saco un rubi');
      afirmar(mc.inventory[4].dano === 1, 'el pico de rubi no se desgasto');
    });

    await prueba('el mob del mod existe, se dibuja con 5 mallas y camina', async () => {
      await arena();
      afirmar(mc.TIPOS['rubi:gelatina'] && mc.TIPOS['rubi:gelatina'].pasivo, 'no esta el tipo de mob');
      const g = mc.spawnMob('rubi:gelatina', CX + 0.5, PY + 3, CZ - 2.5);
      let mallas = 0; g.grupo.traverse(o => { if (o.isMesh) mallas++; });
      afirmar(mallas === 5, `la gelatina tiene ${mallas} mallas`);
      afirmar(await esperar(() => g.onGround, 3000), 'la gelatina no aterrizo');
      g.caminando = true; g.t = 1000; g.dirX = 1; g.dirZ = 0; const x0 = g.pos.x; await dormir(1200);
      afirmar(g.pos.x > x0 + 1, 'la gelatina no camino');
      mc.quitarMob(g);
    });

    await prueba('deja un mundo con mineral colocado, un rubi y un pico en el inventario, guardado con la tabla de ids', async () => {
      await arena();
      mc.setBlock(CX + 4, PY + 1, CZ + 4, 30);
      mc.inventory[0] = { id: 200, count: 5 }; mc.inventory[1] = { id: 201, count: 1, dano: 3 };
      afirmar(await mc.guardarAhora(), 'no se pudo guardar');
      const e = await window.guardado.cargar(mc.mundoId);
      afirmar(e.mods && e.mods.tabla.bloques['rubi:mineral'] === 30 && e.mods.tabla.objetos['rubi:rubi'] === 200, `la tabla guardada es ${JSON.stringify(e.mods)}`);
      afirmar(e.mods.lista.some(m => m.id === 'rubi'), 'la lista de mods no esta en el archivo');
    });
    return resultados;
  }

  if (modo === 'faltante') {
    await prueba('el mundo carga aunque falte el mod: lo suyo queda como "desconocido" con el mismo id', async () => {
      afirmar(mc.chunks.size >= 100, 'el juego no genero el mundo');
      afirmar(!mc.mods.cargados().cargados.some(m => m.id === 'rubi'), 'el mod rubi sigue cargado');
      afirmar(mc.BLOCKS[30] && mc.BLOCKS[30].desconocido && mc.BLOCKS[30].name.includes('rubi:mineral'), `el bloque 30 es ${JSON.stringify(mc.BLOCKS[30])}`);
      afirmar(mc.ITEMS[200] && mc.ITEMS[200].desconocido && mc.ITEMS[201].desconocido, 'los objetos del mod no tienen marcador');
      afirmar(mc.BLOCKS[30].tiles.every(t => t === 63), 'el marcador no usa el tile de desconocido');
      afirmar(mc.getBlock(CX + 4, PY + 1, CZ + 4) === 30, 'el bloque del mod que estaba en el mundo no esta');
      afirmar(mc.inventory[0] && mc.inventory[0].id === 200 && mc.inventory[0].count === 5 && mc.inventory[1].id === 201 && mc.inventory[1].dano === 3, `el inventario cambio: ${JSON.stringify(mc.inventory.slice(0, 2))}`);
      afirmar(el('toast').textContent.includes('Faltan mods') || await esperar(() => el('toast').textContent.includes('Faltan mods'), 2500), 'no avisa que faltan mods');
    });
    await prueba('con un marcador en la mano no se cae el juego (dibujar, poner, romper) y al guardar se conserva la tabla', async () => {
      await arena();
      mc.inventory[0] = { id: 200, count: 5 }; mc.inventory[1] = { id: 201, count: 1, dano: 3 }; mc.selectSlot(0);
      mc.setBlock(CX + 4, PY + 1, CZ + 4, 30);
      await dormir(300);
      mc.setBlock(CX, PY + 2, CZ - 1, 30); mc.selectSlot(8); mc.mouse.left = true;
      afirmar(await esperar(() => mc.getBlock(CX, PY + 2, CZ - 1) === 0, 8000), 'no se pudo romper el bloque desconocido');
      mc.mouse.left = false;
      mc.selectSlot(0); await dormir(300);
      afirmar(await mc.guardarAhora(), 'no se pudo guardar');
      const e = await window.guardado.cargar(mc.mundoId);
      afirmar(e.mods.tabla.bloques['rubi:mineral'] === 30 && e.mods.tabla.objetos['rubi:pico'] === 201, `la tabla se perdio: ${JSON.stringify(e.mods.tabla)}`);
    });
    return resultados;
  }

  if (modo === 'vuelto') {
    await prueba('con el mod de vuelta (y otro que se carga antes) los ids siguen siendo los del mundo', async () => {
      const t = tabla();
      afirmar(t.bloques['aaa:cosa'] === 31, `aaa:cosa es ${t.bloques['aaa:cosa']}: tendria que tomar el 31, porque el 30 es de rubi en este mundo (sin la tabla guardada tomaria el 30)`);
      afirmar(t.bloques['rubi:mineral'] === 30 && t.objetos['rubi:rubi'] === 200 && t.objetos['rubi:pico'] === 201, `ids de rubi: ${JSON.stringify(t)}`);
      afirmar(mc.BLOCKS[30].name === 'Mineral de rubí' && !mc.BLOCKS[30].desconocido, 'el bloque 30 sigue desconocido');
      afirmar(mc.BLOCKS[31].name === 'Cosa' && mc.mods.cargados().cargados.map(m => m.id).join() === 'aaa,rubi', `cargados: ${JSON.stringify(mc.mods.cargados().cargados)}`);
      afirmar(nombre(mc.inventory[0].id) === 'Rubí' && nombre(mc.inventory[1].id) === 'Pico de rubí' && mc.inventory[1].dano === 3, 'el inventario no volvio a ser el del mod');
      afirmar(mc.getBlock(CX + 4, PY + 1, CZ + 4) === 30, 'el mineral colocado no esta');
    });

    await prueba('los eventos llegan a los mods (inicio, cuadro, bloque puesto, mob muerto) y un oyente roto se deja de llamar tras 5 errores', async () => {
      await arena();
      const n = window.__aaa;
      afirmar(n.inicio === 1, `"inicio" llego ${n.inicio} veces, se esperaba 1`);
      await dormir(600);
      afirmar(n.cuadro > 10, `"cuadro" llego solo ${n.cuadro} veces`);
      afirmar(n.malos === 5, `el oyente roto se llamo ${n.malos} veces, se esperaba que se dejara de llamar a las 5`);
      mc.inventory[0] = { id: 31, count: 4 }; mc.selectSlot(0); P.pitch = -1; mc.mouse.right = true;
      afirmar(await esperar(() => n.puesto >= 1, 2500), 'poner un bloque no mando el evento bloque-puesto');
      mc.mouse.right = false;
      afirmar(n.ultimo.id === 31 && Number.isInteger(n.ultimo.x), `el evento bloque-puesto trae ${JSON.stringify(n.ultimo)}`);
      afirmar(mc.getBlock(n.ultimo.x, n.ultimo.y, n.ultimo.z) === 31, 'el bloque del mod no se puso');
      const cerdo = mc.spawnMob('cerdo', CX + 0.5, PY + 1.01, CZ - 3.5);
      mc.golpearMob(cerdo, 100, P.pos.x, P.pos.z);
      afirmar(n.muerto === 1 && n.ultimo.tipo === 'cerdo' && n.ultimo.botin === true, `mob-muerto: ${n.muerto} veces, ${JSON.stringify(n.ultimo)}`);
    });
    return resultados;
  }
  return resultados;
}
