// ============================================================
// pruebas-menu.js - El menu principal y los varios mundos (lo llama test/run.js, que reinicia el juego entre modos).
//   'lista'     el menu muestra los mundos guardados y no carga ningun mundo; los ids raros se rechazan
//   'crear'     llena el formulario y aprieta "Crear mundo" (la pagina se recarga con ?mundo=...)
//   'creado'    ya dentro del mundo recien creado: semilla, nombre y boton de volver al menu
//   'volver'    aprieta "Guardar y volver al menu" (la pagina se recarga en el menu)
//   'lista2'    de nuevo en el menu: aparecen los dos mundos
//   'borrar'    aprieta "Borrar" dos veces sobre el mundo creado
//   'migrado'   el mundo de la version anterior (movido por el menu) aparece como "Mi mundo"; aprieta "Jugar"
//   'jugando'   ya dentro de ese mundo migrado: la semilla es la que tenia
// ============================================================
async (modo) => {
  const dormir = ms => new Promise(r => setTimeout(r, ms));
  const esperar = async (cond, ms = 5000) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) { if (cond()) return true; await dormir(20); }
    return !!cond();
  };
  const afirmar = (cond, msg) => { if (!cond) throw new Error(msg); };
  const el = id => document.getElementById(id);
  const click = e => e.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const tarjetas = () => [...document.querySelectorAll('#menuLista .mundo')];
  const tarjeta = nombre => tarjetas().find(t => t.querySelector('strong').textContent === nombre);

  const resultados = [];
  const prueba = async (nombre, fn) => {
    try { resultados.push({ nombre: `menu: ${nombre}`, ok: true, detalle: (await fn()) || '' }); }
    catch (e) { resultados.push({ nombre: `menu: ${nombre}`, ok: false, detalle: (e && e.message) || String(e) }); }
  };

  if (modo === 'lista' || modo === 'lista2' || modo === 'migrado') {
    await esperar(() => el('menu').style.display === 'flex' && tarjetas().length > 0, 5000);
  }

  if (modo === 'lista') {
    await prueba('al abrir el juego se ve el menu con los mundos y no se carga ningun mundo', async () => {
      afirmar(el('menu').style.display === 'flex', 'el menu no se ve');
      afirmar(el('overlay').style.display === 'none', 'se ve la pantalla de pausa encima del menu');
      afirmar(mc.chunks.size === 0, `se cargaron ${mc.chunks.size} chunks sin elegir un mundo`);
      afirmar(tarjetas().length === 1 && tarjeta('Mundo de prueba'), `se esperaba 1 mundo ("Mundo de prueba"), hay: ${tarjetas().map(t => t.querySelector('strong').textContent).join(', ')}`);
      afirmar(/1337/.test(tarjeta('Mundo de prueba').textContent), 'la tarjeta no muestra la semilla');
      return '1 mundo en la lista';
    });
    await prueba('un id de mundo con caracteres raros se rechaza (no se sale de la carpeta de mundos)', async () => {
      for (const id of ['../x', '..', 'a/b', 'A', '', 'x'.repeat(41), null, 5]) {
        for (const [nombre, llamada] of [['cargar', () => window.guardado.cargar(id)], ['borrar', () => window.guardado.borrar(id)]]) {
          let rechazo = false;
          try { await llamada(); } catch (e) { rechazo = true; }
          afirmar(rechazo, `${nombre}(${JSON.stringify(id)}) no se rechazo`);
        }
      }
    });
    return resultados;
  }

  if (modo === 'crear') {
    await esperar(() => el('menu').style.display === 'flex', 5000);
    el('nuevoNombre').value = 'Mundo <b>del menu</b>';           // con HTML adentro: tiene que mostrarse como texto
    el('nuevaSemilla').value = '4242';
    setTimeout(() => click(el('crearBtn')), 100);                // recarga la pagina (despues de devolver el resultado)
    return [];
  }

  if (modo === 'creado') {
    await prueba('el mundo nuevo arranca con la semilla y el nombre elegidos', async () => {
      afirmar(/^mundo-[a-z0-9]+$/.test(mc.mundoId || ''), `id inesperado: ${mc.mundoId}`);
      afirmar(mc.CONFIG.seed === 4242, `la semilla es ${mc.CONFIG.seed}, se pidio 4242`);
      afirmar(mc.chunks.size >= 200, `solo ${mc.chunks.size} chunks`);
      afirmar(mc.player.vida === 20 && mc.inventory[0] && mc.inventory[0].id === 7, 'no empezo con la salud y el inventario iniciales');
      afirmar(el('menuBtn').style.display !== 'none', 'no se ve el boton para volver al menu');
      return `semilla ${mc.CONFIG.seed}`;
    });
    return resultados;
  }

  if (modo === 'volver') {
    await prueba('el boton "Guardar y volver al menu" existe', async () => { afirmar(el('menuBtn'), 'no hay boton'); });
    setTimeout(() => click(el('menuBtn')), 100);                 // guarda y recarga la pagina en el menu (despues de devolver el resultado)
    return resultados;
  }

  if (modo === 'lista2') {
    await prueba('despues de volver aparecen los dos mundos, con el nombre como texto', async () => {
      afirmar(tarjetas().length === 2, `se esperaban 2 mundos, hay ${tarjetas().length}`);
      const t = tarjeta('Mundo <b>del menu</b>');
      afirmar(t, 'no esta el mundo creado (¿el nombre se interpreto como HTML?)');
      afirmar(!t.querySelector('b'), 'el nombre con HTML se convirtio en una etiqueta');
      afirmar(/4242/.test(t.textContent), 'la tarjeta no muestra la semilla 4242');
      afirmar(tarjetas()[0] === t, 'el mundo jugado mas recientemente no esta primero');
    });
    return resultados;
  }

  if (modo === 'borrar') {
    await esperar(() => el('menu').style.display === 'flex' && tarjetas().length > 0, 5000);
    const t = tarjeta('Mundo <b>del menu</b>');
    if (!t) {
      await prueba('hay un mundo para borrar', async () => { throw new Error(`no esta la tarjeta del mundo creado (hay: ${tarjetas().map(x => x.querySelector('strong').textContent).join(', ')})`); });
      return resultados;
    }
    const borrar = t.querySelector('.borrarBtn');
    click(borrar);
    await prueba('el primer click en Borrar pide confirmar y no borra', async () => {
      afirmar(/Seguro/.test(borrar.textContent), `el boton dice "${borrar.textContent}"`);
      afirmar(tarjetas().length === 2, 'se borro con un solo click');
    });
    click(borrar);
    await prueba('el segundo click borra el mundo de la lista', async () => {
      afirmar(await esperar(() => tarjetas().length === 1, 3000), `siguen ${tarjetas().length} mundos`);
      afirmar(!tarjeta('Mundo <b>del menu</b>'), 'la tarjeta sigue');
    });
    return resultados;
  }

  if (modo === 'migrado') {
    await prueba('la partida de la version anterior aparece como "Mi mundo" con su semilla', async () => {
      const t = tarjeta('Mi mundo');
      afirmar(t, `no esta "Mi mundo" (hay: ${tarjetas().map(x => x.querySelector('strong').textContent).join(', ')})`);
      afirmar(/777/.test(t.textContent), 'la tarjeta no muestra la semilla 777');
      setTimeout(() => click(t.querySelector('.jugarBtn')), 100); // recarga la pagina dentro de ese mundo (despues de devolver el resultado)
    });
    return resultados;
  }

  if (modo === 'jugando') {
    await prueba('el mundo migrado se carga con su semilla y su posicion', async () => {
      afirmar(mc.mundoId === 'mundo-1', `id ${mc.mundoId}`);
      afirmar(mc.CONFIG.seed === 777, `la semilla es ${mc.CONFIG.seed}, se esperaba 777`);
      afirmar(mc.chunks.size >= 200, `solo ${mc.chunks.size} chunks`);
      afirmar(Math.abs(mc.player.pos.x - 8.5) < 0.01 && Math.abs(mc.player.pos.y - 40) < 0.01, `posicion ${mc.player.pos.x}, ${mc.player.pos.y}`);
    });
    return resultados;
  }

  return resultados;
}
