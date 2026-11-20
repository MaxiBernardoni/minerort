// ============================================================
// salud.js - Vida, hambre, danio por caida, muerte y la barra de corazones y muslos.
// Los datos viven en el objeto `player` (player.js). Solo en supervivencia: en creativo no hay danio ni hambre
// (la vida y el hambre quedan como estaban y la barra se oculta).
//
// Reglas (parecidas a Minecraft, simplificadas):
//   - Vida y hambre van de 0 a 20. Cada corazon y cada muslo valen 2.
//   - Caida: lo que pasa de 3 bloques duele (techo de (distancia - 3) puntos). Caer al agua o volando no duele.
//   - Hambre: actividades suman "agotamiento" (correr, saltar, nadar, romper bloques). Cada 4 puntos gastan
//     1 de saturacion, y sin saturacion, 1 de hambre. Caminar solo no cansa.
//   - Con hambre >= 18 la vida se regenera (1 cada 4 s, y eso cansa). Con hambre 0 baja 1 cada 4 s,
//     pero la inanicion nunca mata: se frena en 1 punto (como en dificultad normal).
//   - Al morir se conserva el inventario y se reaparece en el punto de partida del mundo.
// ============================================================
import { CONFIG } from './config.js';
import { player, mouse } from './player.js';
import { creative, invOpen, lockPointer } from './inventory.js';

const MAX = 20;
const CADA_S = 4;                                  // segundos entre regeneraciones / danios por hambre
const el = id => document.getElementById(id);

let invulnerable = 0;                              // segundos sin poder recibir danio despues de un golpe
let reloj = 0;                                     // cuenta para regenerar o pasar hambre

// ---------- barra (corazones y muslos dibujados por codigo, como las texturas) ----------
const CORAZON = ['.oo...oo.', 'oRRo.oRRo', 'oRwRoRRRo', 'oRRRRRRRo', '.oRRRRRo.', '..oRRRo..', '...oRo...', '....o....'];
const MUSLO = ['.....ooo.', '....oBBBo', '...oBwBBo', '...oBBBBo', '..oBBBBo.', '.oWBBBo..', 'oWWoooo..', '.oWo.....', '..o......'];
const COLORES = {
  corazon: { o: '#2a0508', R: '#d8202a', w: '#ff9aa0', vacio: '#3b3b3b' },
  muslo: { o: '#2a1305', B: '#c8742a', w: '#e8a35a', W: '#efe9da', vacio: '#3b3b3b' },
};
// nivel: 2 = lleno, 1 = medio, 0 = vacio. El hueso del muslo siempre se ve.
function icono(patron, colores, nivel) {
  const c = document.createElement('canvas');
  c.width = 9; c.height = patron.length;
  const g = c.getContext('2d');
  patron.forEach((fila, y) => [...fila].forEach((ch, x) => {
    if (ch === '.') return;
    const lleno = nivel === 2 || (nivel === 1 && x < 4.5);
    g.fillStyle = ch === 'o' || ch === 'W' ? colores[ch] : (lleno ? colores[ch] : colores.vacio);
    g.fillRect(x, y, 1, 1);
  }));
  return c.toDataURL();
}
const ICONOS = {
  corazon: [0, 1, 2].map(n => icono(CORAZON, COLORES.corazon, n)),
  muslo: [0, 1, 2].map(n => icono(MUSLO, COLORES.muslo, n)),
};
function crearFila(contenedor, iconos) {
  const imgs = [];
  for (let i = 0; i < 10; i++) {
    const img = document.createElement('img');
    img.className = 'icono';
    img.draggable = false;
    contenedor.appendChild(img);
    imgs.push(img);
  }
  return { imgs, iconos, ultimo: -1 };
}
const filaVida = crearFila(el('corazones'), ICONOS.corazon);
const filaHambre = crearFila(el('hambre'), ICONOS.muslo);
function dibujarFila(fila, valor) {
  if (fila.ultimo === valor) return;
  fila.ultimo = valor;
  fila.imgs.forEach((img, i) => { img.src = fila.iconos[Math.max(0, Math.min(2, valor - i * 2))]; });
}
function actualizarBarra() {
  const visible = !creative && !invOpen;
  el('estado').style.display = visible ? 'flex' : 'none';
  if (visible) { dibujarFila(filaVida, Math.ceil(player.vida)); dibujarFila(filaHambre, Math.ceil(player.hambre)); }
}

// ---------- danio, curacion, comida ----------
function destello() {
  const d = el('dano');
  d.style.transition = 'none'; d.style.opacity = 1;
  requestAnimationFrame(() => requestAnimationFrame(() => { d.style.transition = 'opacity .5s'; d.style.opacity = 0; }));
}

function danar(n, causa = 'dano') {
  if (creative || player.muerto || invulnerable > 0 || n <= 0) return false;
  player.vida = Math.max(0, player.vida - n);
  invulnerable = 0.5;
  destello();
  if (player.vida <= 0) morir(causa);
  return true;
}

function curar(n) { if (!player.muerto) player.vida = Math.min(MAX, player.vida + n); }

// Devuelve true si comio (no se puede comer con el hambre llena)
function comer(valor) {
  if (player.muerto || player.hambre >= MAX) return false;
  player.hambre = Math.min(MAX, player.hambre + valor);
  player.saturacion = Math.min(player.hambre, player.saturacion + valor * 0.6);
  return true;
}

// Actividad que da hambre (correr, saltar, nadar, romper). No hace nada en creativo ni con CONFIG.hambre apagado.
function gastar(n) { if (!creative && CONFIG.hambre && !player.muerto) player.agotamiento += n; }

function alAterrizar(distancia) {
  if (!CONFIG.danoCaida || distancia <= 3) return;
  danar(Math.ceil(distancia - 3), 'caida');
}

// ---------- el paso de cada cuadro ----------
// dt = 0 mientras el juego esta en pausa (la comida y la vida no avanzan)
function actualizarSalud(dt) {
  if (creative) player.agotamiento = 0;                              // en creativo no pasa nada: los valores quedan como estaban
  else if (!player.muerto && dt > 0) {
    invulnerable = Math.max(0, invulnerable - dt);
    while (player.agotamiento >= 4) {                                // el agotamiento gasta saturacion y despues hambre
      player.agotamiento -= 4;
      if (player.saturacion > 0) player.saturacion = Math.max(0, player.saturacion - 1);
      else player.hambre = Math.max(0, player.hambre - 1);
    }
    if (player.hambre >= 18 && player.vida < MAX) {
      reloj += dt;
      if (reloj >= CADA_S) { reloj = 0; curar(1); gastar(6); }
    } else if (player.hambre <= 0 && CONFIG.hambre) {
      reloj += dt;
      if (reloj >= CADA_S) { reloj = 0; if (player.vida > 1) danar(1, 'hambre'); }
    } else reloj = 0;
  }
  actualizarBarra();
}

// ---------- muerte y reaparicion ----------
const MENSAJES = { caida: 'Te caíste desde muy alto', hambre: 'Te quedaste sin comida', dano: 'Moriste' };

function morir(causa) {
  player.muerto = true;
  player.vel.set(0, 0, 0);
  mouse.left = mouse.right = false;
  el('muerteCausa').textContent = MENSAJES[causa] || MENSAJES.dano;
  el('muerte').style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();       // se suelta el mouse para poder apretar el boton
}

// Deja la vida y el hambre al maximo y quita el cartel de muerte (sin mover al jugador)
function resetearSalud() {
  player.vida = player.hambre = MAX; player.saturacion = 5; player.agotamiento = 0; player.muerto = false;
  invulnerable = 0; reloj = 0;
  el('muerte').style.display = 'none';
}

function reaparecer() {
  resetearSalud();
  const s = player.spawn;
  if (s) {
    player.pos.set(s.x, s.y, s.z); player.vel.set(0, 0, 0);
    player.fallMax = player.lastY = s.y;
    player.ajustarSpawn = true;                                      // game.js lo sube si quedo dentro de un bloque
  }
}

el('reaparecerBtn').addEventListener('click', e => { e.stopPropagation(); reaparecer(); lockPointer(); });

export { MAX, danar, curar, comer, gastar, alAterrizar, actualizarSalud, resetearSalud, reaparecer };
