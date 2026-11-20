// ============================================================
// guardado-main.js - Lado Electron del guardado: lee y escribe los mundos.
// Lo usan main.js (juego) y test/run.js (pruebas, con una carpeta temporal).
//
// Cada mundo tiene su carpeta, dentro de la carpeta de datos de la app (en Windows: %APPDATA%\minicraft):
//   mundos\<id>\mundo.json.gz            la partida (JSON comprimido; cada chunk va en base64)
//   mundos\<id>\mundo.respaldo.json.gz   copia del estado con el que se abrio la partida
//   mundos\<id>\meta.json                nombre, semilla y fechas (para armar el menu sin abrir la partida)
// El <id> solo puede tener letras minusculas, numeros y guiones: la pagina lo manda y no debe poder
// apuntar a otra carpeta del disco.
// ============================================================
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const VERSION = 1;                       // debe coincidir con VERSION de src/guardado.js
const ID_VALIDO = /^[a-z0-9-]{1,40}$/;
const ID_MIGRADO = 'mundo-1';            // el mundo unico de la version anterior se mueve a esta carpeta

function carpetaMundo(base, id) {
  if (typeof id !== 'string' || !ID_VALIDO.test(id)) throw new Error('id de mundo invalido');
  return path.join(base, 'mundos', id);
}
const archivo = carpeta => path.join(carpeta, 'mundo.json.gz');
const respaldo = carpeta => path.join(carpeta, 'mundo.respaldo.json.gz');
const metaArchivo = carpeta => path.join(carpeta, 'meta.json');

function leerMeta(carpeta) {
  try { return JSON.parse(fs.readFileSync(metaArchivo(carpeta), 'utf8')); } catch (e) { return {}; }
}

// Guarda de forma atomica: se escribe un archivo temporal y despues se renombra, asi un corte a mitad
// de escritura nunca deja la partida a medias.
function escribir(carpeta, estado, id) {
  fs.mkdirSync(carpeta, { recursive: true });
  const json = JSON.stringify({
    ...estado,
    chunks: estado.chunks.map(c => ({
      cx: c.cx, cz: c.cz, maxY: c.maxY,
      data: Buffer.from(c.data.buffer, c.data.byteOffset, c.data.length).toString('base64'),
    })),
  });
  const temporal = archivo(carpeta) + '.tmp';
  fs.writeFileSync(temporal, zlib.gzipSync(json));
  fs.renameSync(temporal, archivo(carpeta));
  const antes = leerMeta(carpeta), ahora = Date.now();
  fs.writeFileSync(metaArchivo(carpeta), JSON.stringify({
    nombre: estado.nombre || antes.nombre || id, semilla: estado.semilla, creado: antes.creado || ahora, ultimaVez: ahora,
  }));
}

function leer(ruta) {
  const e = JSON.parse(zlib.gunzipSync(fs.readFileSync(ruta)).toString('utf8'));
  if (e.version !== VERSION) throw new Error(`version ${e.version} no soportada (se esperaba ${VERSION})`);
  for (const c of e.chunks) c.data = new Uint8Array(Buffer.from(c.data, 'base64'));
  return e;
}

// Devuelve la partida, o null si no hay ninguna (o ninguna se puede leer).
// Si el archivo principal esta danado prueba con el respaldo.
function cargar(carpeta, avisar = console.warn) {
  for (const [ruta, esRespaldo] of [[archivo(carpeta), false], [respaldo(carpeta), true]]) {
    if (!fs.existsSync(ruta)) continue;
    try {
      const estado = leer(ruta);
      if (!esRespaldo) fs.copyFileSync(ruta, respaldo(carpeta));      // el respaldo es siempre "lo ultimo que se pudo abrir"
      else avisar('[guardado] el archivo principal esta danado: se uso el respaldo');
      return estado;
    } catch (err) {
      avisar(`[guardado] no se pudo leer ${path.basename(ruta)}: ${err.message}`);
    }
  }
  return null;
}

// Borra un mundo entero (su carpeta)
function borrar(carpeta) { fs.rmSync(carpeta, { recursive: true, force: true }); }

// Mueve la partida unica de la version anterior (mundo.json.gz suelto en la carpeta de datos) a mundos\mundo-1
function migrarAntiguo(base, avisar = console.warn) {
  const viejo = path.join(base, 'mundo.json.gz'), viejoRespaldo = path.join(base, 'mundo.respaldo.json.gz');
  if (!fs.existsSync(viejo) && !fs.existsSync(viejoRespaldo)) return;
  const destino = carpetaMundo(base, ID_MIGRADO);
  if (fs.existsSync(destino)) return;                                  // ya hay uno con ese nombre: no se pisa nada
  fs.mkdirSync(destino, { recursive: true });
  let semilla;
  try { semilla = leer(fs.existsSync(viejo) ? viejo : viejoRespaldo).semilla; } catch (e) { /* danado: se migra igual */ }
  if (fs.existsSync(viejo)) fs.renameSync(viejo, archivo(destino));
  if (fs.existsSync(viejoRespaldo)) fs.renameSync(viejoRespaldo, respaldo(destino));
  fs.writeFileSync(metaArchivo(destino), JSON.stringify({ nombre: 'Mi mundo', semilla, creado: Date.now(), ultimaVez: Date.now() }));
  avisar('[guardado] la partida anterior se movio a mundos/' + ID_MIGRADO);
}

// Lista los mundos (mas reciente primero) para el menu
function listar(base, avisar = console.warn) {
  migrarAntiguo(base, avisar);
  const raiz = path.join(base, 'mundos');
  if (!fs.existsSync(raiz)) return [];
  const mundos = [];
  for (const id of fs.readdirSync(raiz)) {
    if (!ID_VALIDO.test(id)) continue;
    const carpeta = path.join(raiz, id);
    if (!fs.existsSync(archivo(carpeta)) && !fs.existsSync(respaldo(carpeta))) continue;   // carpeta vacia o a medias
    const meta = leerMeta(carpeta);
    mundos.push({ id, nombre: meta.nombre || id, semilla: meta.semilla, ultimaVez: meta.ultimaVez || fs.statSync(carpeta).mtimeMs });
  }
  return mundos.sort((a, b) => b.ultimaVez - a.ultimaVez);
}

// base: funcion que devuelve la carpeta de datos (se resuelve al usarla, no al registrar)
function registrar(ipcMain, base, avisar = console.warn) {
  ipcMain.handle('mundo:listar', () => listar(base(), avisar));
  ipcMain.handle('mundo:cargar', (evento, id) => cargar(carpetaMundo(base(), id), avisar));
  ipcMain.handle('mundo:guardar', (evento, id, estado) => { escribir(carpetaMundo(base(), id), estado, id); return true; });
  ipcMain.handle('mundo:borrar', (evento, id) => { borrar(carpetaMundo(base(), id)); return true; });
}

module.exports = { registrar, escribir, cargar, borrar, listar, carpetaMundo, ID_VALIDO };
