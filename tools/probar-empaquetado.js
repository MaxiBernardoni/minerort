// Prueba el juego YA EMPAQUETADO (dist/win-unpacked/MiniCraft.exe, que genera `npm run empaquetar:carpeta`):
// lo abre con una carpeta de datos temporal (no toca tus mundos), mira que aparezca el menu, entra a un mundo, espera a que
// se genere el terreno, guarda la partida y comprueba que el archivo quedo en disco y que no hubo errores en la consola.
// Uso: npm run empaquetar:carpeta && npm run probar-empaquetado     (la ventana se ve unos segundos: no es offscreen)
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const exe = process.env.MINICRAFT_EXE || path.join(__dirname, '..', 'dist', 'win-unpacked', 'MiniCraft.exe');   // MINICRAFT_EXE: probar un .exe ya instalado
const PUERTO = 9333;
const datos = fs.mkdtempSync(path.join(os.tmpdir(), 'minicraft-empaquetado-'));
const pausa = ms => new Promise(r => setTimeout(r, ms));
const errores = [];
let proceso;

function fallar(msg) { console.log('✘ ' + msg); terminar(1); }
function terminar(codigo) {
  try { spawn('taskkill', ['/pid', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) { /* ya cerro */ }
  setTimeout(() => { try { fs.rmSync(datos, { recursive: true, force: true }); } catch (e) { /* sigue abierta */ } process.exit(codigo); }, 1500);
}

async function main() {
  if (!fs.existsSync(exe)) return fallar('no existe ' + exe + ' (corre antes: npm run empaquetar:carpeta)');
  // La pagina del juego, por el protocolo de depuracion de Chromium. El PRIMER arranque despues de armar un .exe nuevo
  // suele colgarse (en esta PC, sin ningun mensaje): si en 25 s no hay ventana, se cierra y se prueba otra vez.
  let pagina = null;
  for (let intento = 1; intento <= 3 && !pagina; intento++) {
    proceso = spawn(exe, [`--user-data-dir=${datos}`, `--remote-debugging-port=${PUERTO}`], { stdio: 'ignore' });
    for (let i = 0; i < 125 && !pagina; i++) {
      await pausa(200);
      try { pagina = (await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json()).find(t => t.type === 'page'); } catch (e) { /* todavia no abre */ }
    }
    if (!pagina) { console.log('(intento ' + intento + ': no abrio ventana en 25 s, se cierra y se reintenta)'); spawn('taskkill', ['/pid', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' }); await pausa(2000); }
  }
  if (!pagina) return fallar('el juego no abrio una ventana en 3 intentos');
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((ok, mal) => { ws.onopen = ok; ws.onerror = mal; });
  let id = 0; const espera = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && espera.has(m.id)) { espera.get(m.id)(m); espera.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errores.push(m.params.args.map(a => a.value || a.description).join(' '));
  };
  const cdp = (method, params = {}) => new Promise(ok => { const n = ++id; espera.set(n, ok); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluar = async expr => { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result.result.value; };
  const esperarCondicion = async (expr, que, ms = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await evaluar(expr).catch(() => false)) return; await pausa(250); }
    fallar('no aparecio ' + que + ' en ' + ms / 1000 + ' s' + (errores.length ? '. Errores: ' + errores.join(' | ') : ''));
    await pausa(5000);
  };
  await cdp('Runtime.enable');

  await esperarCondicion(`!!window.mc && document.getElementById('menu').style.display === 'flex'`, 'el menu principal');
  console.log('✔ el menu principal aparece');

  // Entra a un mundo nuevo (el menu recarga la pagina con ?mundo=...): se navega a la misma pagina con esa direccion
  const base = (await evaluar('location.href')).split('?')[0];
  await cdp('Page.navigate', { url: base + '?mundo=empaquetado&nombre=Prueba&semilla=1337' });
  await esperarCondicion(`!!window.mc && mc.chunks && mc.chunks.size >= 100`, 'el mundo con chunks (¿falta algun archivo en el paquete?)');
  console.log('✔ el mundo se genera: ' + await evaluar('mc.chunks.size') + ' chunks');

  const tieneAgua = await evaluar(`typeof mc.pasoAgua === 'function' && typeof mc.spawnMob === 'function' && !!mc.ITEMS[116]`);
  if (!tieneAgua) return fallar('faltan partes del juego (agua, mobs u objetos)');
  const guardo = await evaluar('mc.guardarAhora()');
  if (!guardo) return fallar('no se pudo guardar la partida');
  const archivo = path.join(datos, 'mundos', 'empaquetado', 'mundo.json.gz');
  if (!fs.existsSync(archivo)) return fallar('el guardado no dejo ' + archivo);
  console.log('✔ la partida se guarda en disco (' + fs.statSync(archivo).size + ' bytes)');

  if (errores.length) return fallar('errores en la consola: ' + errores.join(' | '));
  console.log('✔ sin errores en la consola');
  console.log('\nEl juego empaquetado funciona.');
  terminar(0);
}
main().catch(e => fallar(String(e && e.stack || e)));
