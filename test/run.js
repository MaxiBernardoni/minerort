// ============================================================
// run.js - Corre las pruebas del juego: `npm test`.
// Abre el juego en Electron (sin mostrar ventana) y ejecuta las pruebas adentro de la pagina:
//   1. test/pruebas.js          el juego en marcha, en el mundo "prueba" (la ultima prueba guarda la partida)
//   2. test/pruebas-reinicio.js despues de REINICIAR el juego: la partida vuelve ('restaurado')
//   3. ...con el archivo principal danado: se usa el respaldo ('respaldo')
//   4. ...con los dos archivos danados: empieza un mundo nuevo ('nuevo')
//   5. test/pruebas-menu.js     el menu principal: crear, volver al menu, borrar, y migrar una partida de la
//                               version anterior (cada paso recarga la pagina, como en el juego real)
// Sale con codigo 0 si todo paso, 1 si algo fallo. No instala nada: usa el Electron del proyecto.
// Los mundos de las pruebas van a una carpeta temporal: nunca tocan tus mundos reales.
// ============================================================
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { registrar, escribir, listar } = require('../guardado-main.js');

const LIMITE_MS = 5 * 60 * 1000;     // si las pruebas se cuelgan, se corta y falla
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'minicraft-test-'));
const leer = nombre => fs.readFileSync(path.join(__dirname, nombre), 'utf8');
const pausa = ms => new Promise(r => setTimeout(r, ms));

registrar(ipcMain, () => base, () => {});      // mismo codigo de guardado que main.js, sin ruido en la consola

app.whenReady().then(async () => {
  let codigo = 1;
  const reloj = setTimeout(() => { console.log('\n✘ Las pruebas tardaron mas de 5 minutos: se cortan.'); app.exit(1); }, LIMITE_MS);
  try {
    // offscreen: con la ventana solo oculta Electron baja a ~2 cuadros por segundo y el juego no avanza
    const win = new BrowserWindow({
      width: 1280, height: 720, show: false,
      webPreferences: {
        contextIsolation: true, offscreen: true, backgroundThrottling: false,    // como main.js, mas offscreen
        preload: path.join(__dirname, '..', 'preload.js'),
      },
    });
    const erroresConsola = [];
    win.webContents.on('console-message', (e, nivel, mensaje, linea, fuente) => {
      if (nivel >= 3) erroresConsola.push(`${mensaje} (${path.basename(fuente || '?')}:${linea})`);   // 3 = error (los avisos de seguridad son nivel 2)
    });
    win.webContents.on('render-process-gone', (e, d) => { console.log('✘ El renderer se cayo:', d.reason); app.exit(1); });

    // Espera una condicion dentro de la pagina (20 s como maximo)
    const esperarEnPagina = async (condicion, queEs) => {
      const listo = await win.webContents.executeJavaScript(
        `new Promise(r => { const t0 = Date.now(); (function w() { let ok = false; try { ok = (${condicion}); } catch (e) {} if (ok) r(true); else if (Date.now() - t0 > 20000) r(false); else setTimeout(w, 100); })(); })`);
      if (!listo) throw new Error(`No aparecio ${queEs} en 20 s. Errores: ${erroresConsola.join(' | ')}`);
    };
    const esperarJuego = () => esperarEnPagina('window.mc && mc.chunks.size > 0', 'el mundo (window.mc con chunks)');
    const esperarMenu = () => esperarEnPagina("window.mc && document.getElementById('menu').style.display === 'flex' && document.querySelectorAll('#menuLista .mundo, #menuLista .menuVacio').length > 0", 'el menu');
    const indice = path.join(__dirname, '..', 'index.html');
    const abrir = async (consulta = '') => { await win.loadFile(indice, consulta ? { search: consulta } : undefined); };
    const abrirJuego = async consulta => { await abrir(consulta); await esperarJuego(); };
    const abrirMenu = async () => { await abrir(); await esperarMenu(); };
    const ejecutar = (archivo, argumento) => win.webContents.executeJavaScript(`(${leer(archivo)})(${JSON.stringify(argumento)})`);
    // Para las acciones que recargan la pagina: se escucha la carga ANTES de provocarla
    // (si la pagina no se recarga en 20 s, falla en vez de colgarse hasta el limite de tiempo)
    const recargando = () => new Promise((resolver, rechazar) => {
      win.webContents.once('did-finish-load', resolver);
      setTimeout(() => rechazar(new Error('la pagina no se recargo en 20 s (¿el boton no hizo nada?)')), 20000);
    });

    const carpetaMundo = id => path.join(base, 'mundos', id);
    const archivoPrincipal = path.join(carpetaMundo('prueba'), 'mundo.json.gz');
    const archivoRespaldo = path.join(carpetaMundo('prueba'), 'mundo.respaldo.json.gz');
    const danar = ruta => fs.writeFileSync(ruta, 'esto no es un archivo gzip valido');
    const MUNDO = '?mundo=prueba&nombre=Mundo%20de%20prueba&semilla=1337';
    const MUNDO_YA_CREADO = '?mundo=prueba&nombre=Mundo%20de%20prueba';

    // Filtro opcional por nombre: `npm test -- hora` corre solo las pruebas cuyo nombre contiene "hora" (admite regex)
    const filtro = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : '';

    await abrirJuego(MUNDO);
    const resultados = await ejecutar('pruebas.js', filtro);

    // Las demas fases dependen de la ultima prueba de la fase 1 (la que guarda): solo si corrio
    if (resultados.some(r => r.nombre.startsWith('guardar:'))) {
      await abrirJuego(MUNDO_YA_CREADO);                         // 2. reiniciar el juego
      resultados.push(...await ejecutar('pruebas-reinicio.js', 'restaurado'));
      danar(archivoPrincipal);                                   // 3. archivo principal danado: respaldo
      await abrirJuego(MUNDO_YA_CREADO);
      resultados.push(...await ejecutar('pruebas-reinicio.js', 'respaldo'));
      danar(archivoPrincipal); danar(archivoRespaldo);           // 4. los dos danados: mundo nuevo
      await abrirJuego(MUNDO);
      resultados.push(...await ejecutar('pruebas-reinicio.js', 'nuevo'));
      await win.webContents.executeJavaScript('mc.guardarAhora()');         // deja un mundo valido para el menu

      // 5. Menu principal y varios mundos. Si un paso falla se anota y se sigue con el siguiente bloque, asi un
      //    error no tapa los resultados que ya se tienen.
      try {
      await abrirMenu();
      resultados.push(...await ejecutar('pruebas-menu.js', 'lista'));

      let carga = recargando();
      await ejecutar('pruebas-menu.js', 'crear');                // llena el formulario; la pagina se recarga en el mundo nuevo
      await carga; await esperarJuego(); await pausa(600);       // (el primer guardado del mundo nuevo es inmediato)
      resultados.push(...await ejecutar('pruebas-menu.js', 'creado'));
      const alCrear = listar(base, () => {});
      resultados.push({ nombre: 'menu: el mundo nuevo ya esta en el disco (con su semilla)', ok: alCrear.length === 2 && alCrear.some(m => m.semilla === 4242), detalle: alCrear.map(m => `${m.nombre}/${m.semilla}`).join(', ') });

      carga = recargando();
      resultados.push(...await ejecutar('pruebas-menu.js', 'volver'));
      await carga; await esperarMenu();
      resultados.push(...await ejecutar('pruebas-menu.js', 'lista2'));

      resultados.push(...await ejecutar('pruebas-menu.js', 'borrar'));
      const alBorrar = listar(base, () => {});
      const carpetas = fs.readdirSync(path.join(base, 'mundos'));
      resultados.push({ nombre: 'menu: borrar un mundo elimina su carpeta del disco', ok: alBorrar.length === 1 && carpetas.length === 1, detalle: `carpetas: ${carpetas.join(', ')}` });

      } catch (e) { resultados.push({ nombre: 'menu: crear, volver y borrar mundos', ok: false, detalle: e.message }); }

      // Migracion: la partida unica de la version anterior era un mundo.json.gz suelto en la carpeta de datos
      try {
      escribir(base, {
        // (sin itemsV: en esa version la manzana era el id 11, que hoy es la mesa de crafteo)
        version: 1, semilla: 777, hora: 0.3, creativo: false, seleccionado: 0, inventario: [{ id: 11, count: 2 }, ...Array(35).fill(null)],
        jugador: { x: 8.5, y: 40, z: 8.5, yaw: 0, pitch: 0, vuela: false }, chunks: [],
      }, 'x');
      fs.rmSync(path.join(base, 'meta.json'));                   // la version anterior no tenia meta.json
      await abrirMenu();                                         // al listar, el menu migra la partida
      carga = recargando();
      resultados.push(...await ejecutar('pruebas-menu.js', 'migrado'));
      await carga; await esperarJuego();
      resultados.push(...await ejecutar('pruebas-menu.js', 'jugando'));
      resultados.push({
        nombre: 'menu: la partida de la version anterior se movio a mundos/mundo-1',
        ok: !fs.existsSync(path.join(base, 'mundo.json.gz')) && fs.existsSync(path.join(carpetaMundo('mundo-1'), 'mundo.json.gz')),
        detalle: '',
      });
      } catch (e) { resultados.push({ nombre: 'menu: migrar la partida de la version anterior', ok: false, detalle: e.message }); }
    }

    resultados.push({
      nombre: 'sin errores en la consola',
      ok: erroresConsola.length === 0,
      detalle: erroresConsola.length ? erroresConsola.join(' | ') : '',
    });

    console.log('');
    for (const r of resultados) console.log(`${r.ok ? '✔' : '✘'} ${r.nombre}${r.detalle ? ' — ' + r.detalle : ''}`);
    const fallaron = resultados.filter(r => !r.ok).length;
    console.log(`\n${resultados.length - fallaron} de ${resultados.length} pruebas pasaron${fallaron ? `, ${fallaron} fallaron` : ''}.`);
    codigo = fallaron ? 1 : 0;
  } catch (e) {
    console.log('✘ Error al correr las pruebas:', e.message);
  }
  clearTimeout(reloj);
  fs.rmSync(base, { recursive: true, force: true });
  app.exit(codigo);
});
