// ============================================================
// guardado.js - Guarda y carga la partida del mundo elegido: cambios al mundo, inventario, modo, hora,
// posicion, vida y hambre.
// Los archivos los escribe el proceso principal (guardado-main.js) a traves de window.guardado (preload.js).
// Sin esa API (por ejemplo, si se abre index.html en un navegador) el juego anda pero no guarda.
//
// El mundo que se juega lo elige la direccion de la pagina (el menu recarga la pagina con estos parametros):
//   ?mundo=<id>        que mundo cargar (si no existe todavia, se crea uno nuevo con ese id)
//   &semilla=<numero>  semilla del terreno (solo para un mundo nuevo)
//   &nombre=<texto>    nombre para mostrar en el menu (solo para un mundo nuevo)
// Sin ?mundo=, dentro de Electron, se muestra el menu (menu.js).
//
// Solo se guardan los chunks MODIFICADOS: el resto se regenera de la semilla. Consecuencia: si algun dia cambia
// el generador de terreno, los chunks viejos guardados quedarian distintos a sus vecinos nuevos.
// Agregar campos opcionales al estado no obliga a subir VERSION (los que faltan toman un valor por defecto).
// ============================================================
import { CONFIG, ID } from './config.js';
import { chunks, savedChunks, chunkKey } from './world.js';
import { dayT, setTime } from './sky.js';
import { inventory, creative, selected, setCreative, selectSlot, toast } from './inventory.js';
import { player } from './player.js';
import { cargarMods, estadoMods } from './mods.js';

const VERSION = 1;               // debe coincidir con VERSION de guardado-main.js
const CADA_MS = 30000;           // autoguardado
const parametros = new URLSearchParams(location.search);
const mundoId = parametros.get('mundo');                          // null = sin mundo elegido (menu, o navegador sin guardado)
let mundoNombre = parametros.get('nombre') || mundoId;
let bloqueado = false;           // true mientras se vuelve al menu: nada vuelve a escribir la partida

async function guardarPartida() {
  if (!window.guardado || !mundoId || bloqueado) return false;
  const modificados = new Map(savedChunks);                       // los descargados...
  for (const [k, c] of chunks) if (c.modified) modificados.set(k, c);   // ...y los cargados
  const estado = {
    version: VERSION,
    nombre: mundoNombre,
    semilla: CONFIG.seed,
    hora: dayT,
    creativo: creative,
    seleccionado: selected,
    mods: estadoMods(),                                           // la tabla de ids de los bloques y objetos de mods de este mundo (ver mods.js)
    itemsV: 2,                                                    // 2 = la manzana es el id 100 (antes era el 11, hoy la mesa de crafteo)
    inventario: inventory.map(s => s && { id: s.id, count: s.count, dano: s.dano }),   // dano = usos gastados de una herramienta
    vida: player.vida, hambre: player.hambre, saturacion: player.saturacion,
    spawn: player.spawn,
    jugador: { x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch, vuela: player.fly },
    chunks: [...modificados.values()].map(c => ({ cx: c.cx, cz: c.cz, maxY: c.maxY, data: c.data })),
  };
  try { await window.guardado.guardar(mundoId, estado); return true; }
  catch (err) { console.error('[guardado] no se pudo guardar:', err); return false; }
}

// Devuelve true si habia una partida y se cargo. Hay que llamarla ANTES de generar chunks (cambia la semilla).
async function cargarPartida() {
  let e = null;
  if (window.guardado && mundoId) {
    try { e = await window.guardado.cargar(mundoId); }
    catch (err) { console.error('[guardado] no se pudo cargar:', err); }
  }
  const hayEstado = !!e && e.version === VERSION;
  await cargarMods(hayEstado ? e.mods && e.mods.tabla : null);     // los mods se registran ANTES de leer chunks e inventario (que pueden tener sus ids)
  if (!hayEstado) {
    // Mundo nuevo: la semilla viene de la direccion (el menu la elige al crearlo)
    const s = parametros.get('semilla');
    if (s !== null && Number.isFinite(+s)) CONFIG.seed = +s | 0;
    return false;
  }

  mundoNombre = e.nombre || mundoNombre;
  CONFIG.seed = e.semilla;
  for (const c of e.chunks) savedChunks.set(chunkKey(c.cx, c.cz), { cx: c.cx, cz: c.cz, maxY: c.maxY, data: c.data });
  setCreative(e.creativo);
  // Una partida anterior a los objetos nuevos (sin itemsV) tenia la manzana como id 11, que hoy es la mesa de crafteo
  if (!e.itemsV) for (const s of e.inventario) if (s && s.id === 11) s.id = ID.MANZANA;
  inventory.fill(null);
  e.inventario.forEach((s, i) => { inventory[i] = s; });
  selectSlot(e.seleccionado);                                     // tambien refresca la interfaz del inventario
  setTime(e.hora);
  if (e.spawn) player.spawn = e.spawn;
  const j = e.jugador;
  player.pos.set(j.x, j.y, j.z); player.vel.set(0, 0, 0);
  player.yaw = j.yaw; player.pitch = j.pitch; player.fly = j.vuela;
  // Salud: una partida de la version anterior no tiene estos campos (arranca llena). Si se cerro el juego en la
  // pantalla de muerte (vida 0), se reaparece en el punto de inicio.
  const hayVida = typeof e.vida === 'number' && e.vida > 0;
  player.vida = hayVida ? e.vida : 20;
  player.hambre = hayVida ? (e.hambre ?? 20) : 20;
  player.saturacion = hayVida ? (e.saturacion ?? 5) : 5;
  if (typeof e.vida === 'number' && !hayVida && player.spawn) { const s = player.spawn; player.pos.set(s.x, s.y, s.z); player.ajustarSpawn = true; }
  toast('Partida cargada');
  return true;
}

// Guarda y vuelve al menu de mundos (recargando la pagina sin parametros)
async function volverAlMenu() {
  await guardarPartida();
  bloqueado = true;
  location.assign(location.pathname);
}

// Autoguardado, guardar al cerrar y el boton "Volver al menu" de la pantalla de pausa
function iniciarGuardado() {
  if (!window.guardado || !mundoId) return;
  setInterval(guardarPartida, CADA_MS);
  window.guardado.alCerrar(guardarPartida);
  guardarPartida();                                               // un mundo nuevo aparece en el menu desde el primer momento

  const boton = document.getElementById('menuBtn');
  boton.style.display = 'inline-block';
  boton.addEventListener('click', e => {
    e.stopPropagation();                                          // un click en la pausa vuelve al juego: este no
    volverAlMenu();
  });
}

export { mundoId, cargarPartida, guardarPartida, iniciarGuardado, volverAlMenu };
