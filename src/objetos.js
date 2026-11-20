// ============================================================
// objetos.js - Recetas de crafteo y reglas de las herramientas.
// Son funciones puras (sin pantalla ni estado): inventory.js y game.js las usan, y se pueden probar solas.
// Los datos de cada bloque y objeto estan en config.js (BLOCKS, ITEMS).
// ============================================================
import { ID, ITEMS, itemInfo } from './config.js';

const MAX_PILA = 64;

// Cuantos caben en una casilla: las herramientas no se apilan (cada una tiene su propio desgaste)
function maxPila(id) {
  const info = itemInfo(id);
  return info && info.dur ? 1 : MAX_PILA;
}

// ---------- Recetas ----------
// forma: filas de ids (0 = casilla vacia). Se reconoce en CUALQUIER posicion de la grilla y tambien espejada.
// da: [id, cantidad]
const { MADERA, TABLONES, ADOQUIN, PALO, MESA } = ID;
const RECETAS = [
  { forma: [[MADERA]], da: [TABLONES, 4] },                          // 1 madera -> 4 tablones
  { forma: [[TABLONES], [TABLONES]], da: [PALO, 4] },                // 2 tablones, uno sobre otro -> 4 palos
  { forma: [[TABLONES, TABLONES], [TABLONES, TABLONES]], da: [MESA, 1] },   // 4 tablones en cuadrado -> mesa de crafteo
];
// Herramientas: cada material da pico, hacha y pala. Todas ocupan 3 filas, asi que se fabrican en la mesa (3x3).
for (const [m, pico, hacha, pala] of [
  [TABLONES, ID.PICO_MADERA, ID.HACHA_MADERA, ID.PALA_MADERA],
  [ADOQUIN, ID.PICO_PIEDRA, ID.HACHA_PIEDRA, ID.PALA_PIEDRA],
]) {
  RECETAS.push(
    { forma: [[m, m, m], [0, PALO, 0], [0, PALO, 0]], da: [pico, 1] },
    { forma: [[m, m], [m, PALO], [0, PALO]], da: [hacha, 1] },
    { forma: [[m], [PALO], [PALO]], da: [pala, 1] },
  );
}

// Recorta la grilla a la caja que ocupan los ingredientes (filas y columnas vacias de los bordes se descartan)
function recortar(grilla, ancho) {
  const filas = [];
  for (let y = 0; y < grilla.length / ancho; y++) filas.push(grilla.slice(y * ancho, y * ancho + ancho));
  const ys = filas.map((f, y) => y).filter(y => filas[y].some(x => x > 0));
  if (!ys.length) return null;
  const xs = [...Array(ancho).keys()].filter(x => filas.some(f => f[x] > 0));
  return filas.slice(ys[0], ys[ys.length - 1] + 1).map(f => f.slice(xs[0], xs[xs.length - 1] + 1));
}
const igual = (a, b) => a.length === b.length && a.every((f, y) => f.length === b[y].length && f.every((v, x) => v === b[y][x]));
const espejo = forma => forma.map(f => [...f].reverse());

// grilla: ids en orden de filas (0 = vacio), ancho = lado (2 en el inventario, 3 en la mesa).
// Devuelve { id, count } o null si no hay receta.
function buscarReceta(grilla, ancho) {
  const forma = recortar(grilla, ancho);
  if (!forma) return null;
  for (const r of RECETAS) {
    if (igual(forma, r.forma) || igual(forma, espejo(r.forma))) return { id: r.da[0], count: r.da[1] };
  }
  return null;
}

// ---------- Herramientas ----------
// Multiplicador de velocidad al romper `bloque` (una entrada de BLOCKS) con lo que se sostiene
function velocidadDeMinado(idEnMano, bloque) {
  const item = ITEMS[idEnMano];
  return item && item.tool && item.tool === bloque.herramienta ? item.velocidad : 1;
}

// ¿Suelta algo el bloque al romperlo con lo que se sostiene? (la piedra sin pico no)
function puedeRecoger(idEnMano, bloque) {
  if (!bloque.necesita) return true;
  const item = ITEMS[idEnMano];
  return !!(item && item.tool === bloque.herramienta);
}

const esHerramienta = id => !!(ITEMS[id] && ITEMS[id].tool);

export { MAX_PILA, maxPila, RECETAS, buscarReceta, velocidadDeMinado, puedeRecoger, esHerramienta };
