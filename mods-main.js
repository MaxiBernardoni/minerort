// ============================================================
// mods-main.js - Lado Electron de los mods: lista las carpetas de la carpeta de mods y valida sus manifiestos.
// Lo usan main.js (juego) y test/run.js (pruebas, con una carpeta temporal). El juego en si (src/mods.js) los importa.
//
// La carpeta de mods es <datos de la app>\mods (en Windows: %APPDATA%\minicraft\mods). Cada mod es una carpeta con:
//   mod.json   { id, nombre, version, autor, descripcion, apiVersion, main }
//   <main>     un modulo ES (por defecto mod.js) que exporta por defecto una funcion que recibe la API
// La pagina nunca elige rutas: recibe de aca las direcciones (file://) ya validadas, que quedan dentro de la carpeta del mod.
// Un mod es codigo que el usuario instalo a mano: se confia en el (ver docs/07-mods.md).
// ============================================================
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const API_VERSION = 1;                       // debe coincidir con API_VERSION de src/mods.js
const ID_VALIDO = /^[a-z0-9-]{1,30}$/;
const carpetaMods = base => path.join(base, 'mods');

function leerManifiesto(carpeta) {
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(carpeta, 'mod.json'), 'utf8')); }
  catch (e) { throw new Error(e.code === 'ENOENT' ? 'falta mod.json' : 'mod.json no se puede leer: ' + e.message); }
  if (!m || typeof m !== 'object') throw new Error('mod.json tiene que ser un objeto');
  if (typeof m.id !== 'string' || !ID_VALIDO.test(m.id)) throw new Error('el id del mod solo puede tener letras minusculas, numeros y guiones (hasta 30)');
  if (typeof m.nombre !== 'string' || !m.nombre.trim()) throw new Error('falta el nombre del mod');
  if (m.apiVersion !== API_VERSION) throw new Error(`el mod es para la API ${m.apiVersion} y este juego tiene la ${API_VERSION}`);
  const main = m.main === undefined ? 'mod.js' : m.main;
  if (typeof main !== 'string' || !main.endsWith('.js')) throw new Error('"main" tiene que ser un archivo .js');
  const ruta = path.resolve(carpeta, main);
  if (!ruta.startsWith(path.resolve(carpeta) + path.sep)) throw new Error('"main" tiene que estar dentro de la carpeta del mod');
  if (!fs.existsSync(ruta)) throw new Error('no existe ' + main);
  return { manifest: { id: m.id, nombre: m.nombre, version: String(m.version || '?'), autor: String(m.autor || ''), descripcion: String(m.descripcion || '') }, ruta };
}

// [{ carpeta, id, manifest, url }] o { carpeta, id, error } si ese mod no se puede cargar. Ordenados por id (el orden de carga).
function listarMods(base) {
  const dir = carpetaMods(base);
  fs.mkdirSync(dir, { recursive: true });
  const lista = [], vistos = new Set();
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    try {
      const { manifest, ruta } = leerManifiesto(path.join(dir, d.name));
      if (vistos.has(manifest.id)) throw new Error(`hay otro mod con el id "${manifest.id}"`);
      vistos.add(manifest.id);
      lista.push({ carpeta: d.name, id: manifest.id, manifest, url: pathToFileURL(ruta).href });
    } catch (e) { lista.push({ carpeta: d.name, id: d.name, error: e.message }); }
  }
  return lista.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// `shell` (de electron) es opcional: sin el, no se puede abrir la carpeta (las pruebas no lo necesitan)
function registrarMods(ipcMain, getBase, shell) {
  ipcMain.handle('mods:listar', () => listarMods(getBase()));
  ipcMain.handle('mods:abrir-carpeta', async () => {
    const dir = carpetaMods(getBase());
    fs.mkdirSync(dir, { recursive: true });
    if (shell) await shell.openPath(dir);
    return dir;
  });
}

module.exports = { registrarMods, listarMods, carpetaMods, API_VERSION };
