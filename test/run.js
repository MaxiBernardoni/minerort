// ============================================================
// run.js - Corre las pruebas del juego: `npm test`.
// Abre el juego en Electron (sin mostrar ventana), ejecuta test/pruebas.js adentro de la pagina
// y sale con codigo 0 si todo paso, 1 si algo fallo. No instala nada: usa el Electron del proyecto.
// ============================================================
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const LIMITE_MS = 4 * 60 * 1000;     // si las pruebas se cuelgan, se corta y falla

app.whenReady().then(async () => {
  let codigo = 1;
  const reloj = setTimeout(() => { console.log('\n✘ Las pruebas tardaron mas de 4 minutos: se cortan.'); app.exit(1); }, LIMITE_MS);
  try {
    // offscreen: con la ventana solo oculta Electron baja a ~2 cuadros por segundo y el juego no avanza
    const win = new BrowserWindow({
      width: 1280, height: 720, show: false,
      webPreferences: { contextIsolation: true, offscreen: true, backgroundThrottling: false },   // como main.js
    });
    const erroresConsola = [];
    win.webContents.on('console-message', (e, nivel, mensaje, linea, fuente) => {
      if (nivel >= 3) erroresConsola.push(`${mensaje} (${path.basename(fuente || '?')}:${linea})`);   // 3 = error (los avisos de seguridad son nivel 2)
    });
    win.webContents.on('render-process-gone', (e, d) => { console.log('✘ El renderer se cayo:', d.reason); app.exit(1); });

    await win.loadFile(path.join(__dirname, '..', 'index.html'));
    const listo = await win.webContents.executeJavaScript(
      `new Promise(r => { const t0 = Date.now(); (function w() { if (window.mc && mc.chunks.size > 0) r(true); else if (Date.now() - t0 > 20000) r(false); else setTimeout(w, 100); })(); })`);
    if (!listo) throw new Error('El juego no arranco en 20 s (no aparece window.mc). Errores: ' + erroresConsola.join(' | '));

    const codigoPruebas = fs.readFileSync(path.join(__dirname, 'pruebas.js'), 'utf8');
    // Filtro opcional por nombre: `npm test -- hora` corre solo las pruebas cuyo nombre contiene "hora" (admite regex)
    const filtro = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : '';
    const resultados = await win.webContents.executeJavaScript(`(${codigoPruebas})(${JSON.stringify(filtro)})`);

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
  app.exit(codigo);
});
