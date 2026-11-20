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
import { CONFIG } from './config.js';
import { chunks, savedChunks, chunkKey } from './world.js';
import { dayT, setTime } from './sky.js';
import { inventory, creative, selected, setCreative, selectSlot, toast } from './inventory.js';
import { player } from './player.js';

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
    inventario: inventory.map(s => s && { id: s.id, count: s.count }),
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
  if (!e || e.version !== VERSION) {
    // Mundo nuevo: la semilla viene de la direccion (el menu la elige al crearlo)
    const s = parametros.get('semilla');
    if (s !== null && Number.isFinite(+s)) CONFIG.seed = +s | 0;
    return false;
  }

  mundoNombre = e.nombre || mundoNombre;
  CONFIG.seed = e.semilla;
  for (const c of e.chunks) savedChunks.set(chunkKey(c.cx, c.cz), { cx: c.cx, cz: c.cz, maxY: c.maxY, data: c.data });
  setCreative(e.creativo);
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
