// ============================================================
// inventory.js - Inventario (36 espacios), barra rapida, pantalla de inventario con arrastrar/soltar,
// crafteo (grilla de 2x2 en el inventario y de 3x3 en la mesa) y objetos que caen al suelo y se recogen.
//   - Espacios 0-8 = barra rapida, 9-35 = mochila.
//   - E abre/cierra. Click: agarrar/soltar. Click der.: mitad / uno. Shift+click: mover rapido.
//   - Pasar el mouse sobre un espacio y apretar 1-9 lo manda a la barra.
//   - Modo creativo: catalogo de todos los bloques y objetos (con pestañas y buscador), sin gastar nada.
//   - Cada casilla es null o { id, count, dano }: `dano` son los usos gastados de una herramienta (no se apilan).
// Las recetas y reglas de herramientas estan en objetos.js; los datos de bloques y objetos en config.js.
// ============================================================

import * as THREE from 'three';
import { CONFIG, BLOCKS, ITEMS, ITEM_IDS, itemInfo, isSolidB } from './config.js';
import { maxPila, buscarReceta, esHerramienta } from './objetos.js';
import { makeBlockIcon, atlasTexture } from './textures.js';
import { scene, camera, canvas } from './scene.js';
import { getBlock } from './world.js';
import { daylight } from './sky.js';
import { setHandBlock, makeBlockGeometry, esItem, makeItemGeometry, itemMaterial } from './effects.js';
import { player, mouse, lookDir } from './player.js';

const inventory = new Array(36).fill(null);     // cada espacio: null o { id, count, dano }
let selected = 0;                               // espacio activo de la barra
let cursor = null;                              // pila que se esta arrastrando
let invOpen = false;
let creative = CONFIG.creative;
let hoverSlot = null;                           // espacio bajo el mouse (para las teclas 1-9)

// Crafteo: las casillas de la grilla (hasta 9) y lo que se fabrica con ellas. Los "indices de casilla" de la
// pantalla son 0-35 para el inventario, 100+k para la grilla y 200 para el resultado.
const CELDA = 100, RESULTADO = 200;
const craft = new Array(9).fill(null);
let craftLado = 2;                              // 2 = inventario, 3 = mesa de crafteo
let resultado = null;                           // { id, count } o null

const heldId = () => (inventory[selected] ? inventory[selected].id : 0);

// Una pila nueva (la herramienta conserva su desgaste cuando se mueve de lugar)
function nuevaPila(id, count, dano) {
  const s = { id, count };
  if (dano) s.dano = dano;
  return s;
}

// ---------- iconos ----------
const iconCache = {};
const getIcon = id => iconCache[id] || (iconCache[id] = makeBlockIcon(id));

// ---------- avisos ----------
const toastEl = document.getElementById('toast');
let toastTimer = 0;
function toast(text) {
  toastEl.textContent = text;
  toastEl.style.opacity = text ? 1 : 0;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.opacity = 0; }, 1200);
}

// ---------- logica de pilas ----------
function invCanAdd(id) {
  return inventory.some(s => !s || (s.id === id && s.count < maxPila(id)));
}
// Cuantos del objeto `id` entran todavia en el inventario
function espacioPara(id) {
  const max = maxPila(id);
  return inventory.reduce((n, s) => n + (!s ? max : s.id === id ? max - s.count : 0), 0);
}
// Agrega items (barra primero, despues mochila). Devuelve lo que no entro. `dano` es el desgaste de una herramienta.
function invAdd(id, count, dano) {
  const max = maxPila(id);
  for (let i = 0; i < 36 && count > 0; i++) {
    const s = inventory[i];
    if (s && s.id === id && s.count < max) { const n = Math.min(max - s.count, count); s.count += n; count -= n; }
  }
  for (let i = 0; i < 36 && count > 0; i++) {
    if (!inventory[i]) { const n = Math.min(max, count); inventory[i] = nuevaPila(id, n, dano); count -= n; }
  }
  refreshInventoryUI();
  return count;
}
function consumeHeld() {
  if (creative) return;
  const s = inventory[selected];
  if (!s) return;
  if (--s.count <= 0) inventory[selected] = null;
  refreshInventoryUI();
}
// Gasta un uso de la herramienta que se sostiene (al romper un bloque). Cuando se agota, se rompe.
function gastarHerramienta() {
  if (creative) return;
  const s = inventory[selected];
  if (!s || !esHerramienta(s.id)) return;
  s.dano = (s.dano || 0) + 1;
  if (s.dano >= ITEMS[s.id].dur) { toast('Se rompió: ' + ITEMS[s.id].name); inventory[selected] = null; }
  refreshInventoryUI();
}

// ---------- interfaz: barra rapida (siempre visible) ----------
const hotbarEl = document.getElementById('hotbar');
function makeSlotEl(cls) {
  const d = document.createElement('div');
  d.className = cls;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const n = document.createElement('span');
  n.className = 'count';
  d.append(c, n);
  return d;
}
function renderSlot(el, stack) {
  const c = el.firstChild, g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  if (stack) g.drawImage(getIcon(stack.id), 0, 0);
  if (stack && stack.dano > 0 && esHerramienta(stack.id)) {         // barrita de desgaste: verde lleno, roja casi rota
    const f = 1 - stack.dano / ITEMS[stack.id].dur;
    g.fillStyle = '#111'; g.fillRect(6, 55, 52, 6);
    g.fillStyle = `hsl(${Math.round(120 * f)}, 90%, 45%)`; g.fillRect(7, 56, Math.max(1, Math.round(50 * f)), 4);
  }
  el.lastChild.textContent = stack && stack.count > 1 ? stack.count : '';
}

const hudSlots = [];
for (let i = 0; i < 9; i++) {
  const el = makeSlotEl('slot');
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = i + 1;
  el.appendChild(num);
  hotbarEl.appendChild(el);
  hudSlots.push(el);
}

// ---------- interfaz: pantalla de inventario ----------
const invEl = document.getElementById('inventory');
const panel = document.getElementById('invPanel');
const cursorEl = makeSlotEl('cursorItem');
const tipEl = document.getElementById('tooltip');
document.body.appendChild(cursorEl);

const modeBtn = document.createElement('button');
modeBtn.id = 'modeBtn';
modeBtn.addEventListener('click', e => { e.stopPropagation(); setCreative(!creative); });

const tituloEl = document.createElement('h2');
const title = document.createElement('div');
title.className = 'invTitle';
title.append(tituloEl, modeBtn);

// Crafteo: la grilla (de 2x2 o de 3x3 segun donde se abre), una flecha y la casilla del resultado
const craftSeccion = Object.assign(document.createElement('div'), { id: 'craftSeccion' });
const craftLabel = Object.assign(document.createElement('div'), { className: 'invLabel', textContent: 'Crafteo' });
const craftFila = Object.assign(document.createElement('div'), { className: 'craftFila' });
const craftGrid2 = Object.assign(document.createElement('div'), { id: 'craftGrid2', className: 'craftGrid g2' });
const craftGrid3 = Object.assign(document.createElement('div'), { id: 'craftGrid3', className: 'craftGrid g3' });
const flecha = Object.assign(document.createElement('div'), { className: 'flecha', textContent: '➜' });
const resultEl = makeSlotEl('islot resultado');
resultEl.id = 'craftResultado';
craftFila.append(craftGrid2, craftGrid3, flecha, resultEl);
craftSeccion.append(craftLabel, craftFila);

// Catalogo del modo creativo: pestañas (Todo / Bloques / Objetos) y un buscador
const catalogLabel = Object.assign(document.createElement('div'), { className: 'invLabel', textContent: 'Catálogo creativo (click: pila completa · click der.: 1)' });
const catalogBar = Object.assign(document.createElement('div'), { className: 'catalogBar' });
const catalogGrid = Object.assign(document.createElement('div'), { className: 'grid' });
const buscador = Object.assign(document.createElement('input'), { id: 'catalogBuscar', placeholder: 'Buscar…', maxLength: 20 });
const PESTANAS = [['todo', 'Todo'], ['bloques', 'Bloques'], ['objetos', 'Objetos']];
const pestanaBtns = PESTANAS.map(([clave, texto]) => {
  const b = Object.assign(document.createElement('button'), { textContent: texto, className: 'pestana' });
  b.dataset.clave = clave;
  b.addEventListener('click', e => { e.stopPropagation(); pestanaActual = clave; filtrarCatalogo(); });
  return b;
});
catalogBar.append(...pestanaBtns, buscador);

const storageLabel = Object.assign(document.createElement('div'), { className: 'invLabel', textContent: 'Mochila' });
const storageGrid = Object.assign(document.createElement('div'), { className: 'grid' });
const hotbarLabel = Object.assign(document.createElement('div'), { className: 'invLabel', textContent: 'Barra rápida' });
const hotbarGrid = Object.assign(document.createElement('div'), { className: 'grid' });
const hint = Object.assign(document.createElement('div'), {
  className: 'invHint',
  textContent: 'Click: mover · Click der.: mitad / uno · Shift+click: mover rápido · 1-9 sobre un espacio: pasar a la barra · Click afuera: tirar · E / Esc: cerrar',
});
panel.append(title, craftSeccion, catalogLabel, catalogBar, catalogGrid, storageLabel, storageGrid, hotbarLabel, hotbarGrid, hint);

const invSlots = new Array(36);     // elementos DOM de las 36 casillas del inventario
function attachSlot(el, index) {
  if (index < 36) invSlots[index] = el;
  el.addEventListener('mousedown', e => { e.stopPropagation(); slotClick(index, e); });
  el.addEventListener('mouseenter', () => { hoverSlot = index; showTip(stackAt(index)); });
  el.addEventListener('mouseleave', () => { hoverSlot = null; tipEl.style.display = 'none'; });
}
for (let i = 9; i < 36; i++) { const el = makeSlotEl('islot'); attachSlot(el, i); storageGrid.appendChild(el); }
for (let i = 0; i < 9; i++) { const el = makeSlotEl('islot'); attachSlot(el, i); hotbarGrid.appendChild(el); }
const celdas2 = [], celdas3 = [];   // elementos DOM de las casillas de las dos grillas de crafteo
for (let k = 0; k < 4; k++) { const el = makeSlotEl('islot'); attachSlot(el, CELDA + k); craftGrid2.appendChild(el); celdas2.push(el); }
for (let k = 0; k < 9; k++) { const el = makeSlotEl('islot'); attachSlot(el, CELDA + k); craftGrid3.appendChild(el); celdas3.push(el); }
attachSlot(resultEl, RESULTADO);

const catalogSlots = [];            // { el, id }
ITEM_IDS.forEach(id => {
  const el = makeSlotEl('islot');
  renderSlot(el, { id, count: 1 });
  el.lastChild.textContent = '';
  el.addEventListener('mousedown', e => {
    e.stopPropagation();
    if (cursor) cursor = null;                                    // soltar sobre el catalogo = borrar
    else cursor = { id, count: e.button === 2 ? 1 : maxPila(id) };
    refreshInventoryUI();
  });
  el.addEventListener('mouseenter', () => showTip({ id, count: 1 }));
  el.addEventListener('mouseleave', () => { tipEl.style.display = 'none'; });
  catalogGrid.appendChild(el);
  catalogSlots.push({ el, id });
});

let pestanaActual = 'todo';
const sinAcentos = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");   // "Adoquín" se encuentra buscando "adoquin"
function filtrarCatalogo() {
  const q = sinAcentos(buscador.value.trim());
  for (const { el, id } of catalogSlots) {
    const esObjeto = !!ITEMS[id];
    const enPestana = pestanaActual === 'todo' || (pestanaActual === 'objetos') === esObjeto;
    el.style.display = enPestana && (!q || sinAcentos(itemInfo(id).name).includes(q)) ? '' : 'none';
  }
  pestanaBtns.forEach(b => b.classList.toggle('activa', b.dataset.clave === pestanaActual));
}
buscador.addEventListener('input', filtrarCatalogo);
// Al escribir en el buscador, "e" o un numero no tienen que cerrar el inventario ni cambiar de ranura (Esc si cierra)
buscador.addEventListener('keydown', e => { if (e.code !== 'Escape') e.stopPropagation(); });
// Clicks en las pestañas, el buscador y el boton de modo no tiran lo que tengas en el cursor (el click afuera del panel si)
catalogBar.addEventListener('mousedown', e => e.stopPropagation());
modeBtn.addEventListener('mousedown', e => e.stopPropagation());
filtrarCatalogo();

function showTip(stack) {
  if (!stack) { tipEl.style.display = 'none'; return; }
  const info = itemInfo(stack.id);
  let t = info.name + (stack.count > 1 ? ' ×' + stack.count : '');
  if (info.dur) t += ` (${info.dur - (stack.dano || 0)}/${info.dur} usos)`;
  tipEl.textContent = t;
  tipEl.style.display = 'block';
}

// Que partes de la pantalla se ven segun el modo (creativo o supervivencia) y donde se abrio (inventario o mesa)
function actualizarPaneles() {
  tituloEl.textContent = craftLado === 3 ? 'Mesa de crafteo' : 'Inventario';
  catalogLabel.style.display = catalogBar.style.display = catalogGrid.style.display = creative ? '' : 'none';
  craftSeccion.style.display = (!creative || craftLado === 3) ? '' : 'none';   // en creativo el 2x2 sobra; la mesa siempre se ve
  craftGrid2.style.display = craftLado === 2 ? '' : 'none';
  craftGrid3.style.display = craftLado === 3 ? '' : 'none';
}

function setCreative(v) {
  creative = v;
  modeBtn.textContent = creative ? 'Modo: Creativo' : 'Modo: Supervivencia';
  actualizarPaneles();
  toast(creative ? 'Modo creativo' : 'Modo supervivencia');
  refreshInventoryUI();
}

// ---------- clicks sobre los espacios ----------
function stackAt(i) {
  if (i === RESULTADO) return resultado;
  return i >= CELDA ? craft[i - CELDA] : inventory[i];
}
function setAt(i, valor) {
  if (i >= CELDA) craft[i - CELDA] = valor; else inventory[i] = valor;
}

function slotClick(i, e) {
  if (i === RESULTADO) { clickResultado(e); return; }
  const s = stackAt(i), right = e.button === 2;
  if (e.shiftKey && !right) {                                      // mover rapido: barra <-> mochila, o de la grilla a la mochila
    if (s) {
      const [from, to] = i >= CELDA ? [0, 36] : i < 9 ? [9, 36] : [0, 9];
      const left = moveInto(s, from, to);
      setAt(i, left > 0 ? nuevaPila(s.id, left, s.dano) : null);
    }
  } else if (!right) {
    if (!cursor) { if (s) { cursor = s; setAt(i, null); } }
    else if (!s) { setAt(i, cursor); cursor = null; }
    else if (s.id === cursor.id && maxPila(s.id) > 1) {            // las herramientas no se juntan
      const n = Math.min(maxPila(s.id) - s.count, cursor.count);
      s.count += n; cursor.count -= n;
      if (cursor.count <= 0) cursor = null;
    } else { setAt(i, cursor); cursor = s; }
  } else {
    if (!cursor) {
      if (s) {
        const half = Math.ceil(s.count / 2);
        cursor = nuevaPila(s.id, half, s.dano);
        s.count -= half;
        if (s.count <= 0) setAt(i, null);
      }
    } else if (!s) { setAt(i, nuevaPila(cursor.id, 1, cursor.dano)); if (--cursor.count <= 0) cursor = null; }
    else if (s.id === cursor.id && s.count < maxPila(s.id)) { s.count++; if (--cursor.count <= 0) cursor = null; }
  }
  showTip(stackAt(i));
  refreshInventoryUI();
}

// Mete una pila en el rango [from, to) del inventario. Devuelve lo que no entro.
function moveInto(stack, from, to) {
  let count = stack.count;
  const max = maxPila(stack.id);
  for (let i = from; i < to && count > 0; i++) {
    const s = inventory[i];
    if (s && s.id === stack.id && s.count < max) { const n = Math.min(max - s.count, count); s.count += n; count -= n; }
  }
  for (let i = from; i < to && count > 0; i++) {
    if (!inventory[i]) { const n = Math.min(max, count); inventory[i] = nuevaPila(stack.id, n, stack.dano); count -= n; }
  }
  return count;
}

// 1-9 con el mouse sobre un espacio del inventario: intercambia con ese espacio de la barra
function hotkeySwap(n) {
  if (hoverSlot === null || hoverSlot >= 36 || hoverSlot === n) return;
  [inventory[hoverSlot], inventory[n]] = [inventory[n], inventory[hoverSlot]];
  refreshInventoryUI();
}

// ---------- crafteo ----------
function recalcularResultado() {
  const ids = [];
  for (let k = 0; k < craftLado * craftLado; k++) ids.push(craft[k] ? craft[k].id : 0);
  resultado = buscarReceta(ids, craftLado);
}
function consumirIngredientes() {                                  // una unidad de cada casilla
  for (let k = 0; k < craft.length; k++) if (craft[k] && --craft[k].count <= 0) craft[k] = null;
}
function clickResultado(e) {
  recalcularResultado();
  if (!resultado) return;
  if (e.shiftKey) {                                                // fabricar todo lo que se pueda y mandarlo a la mochila
    for (let n = 0; n < 300 && resultado && espacioPara(resultado.id) >= resultado.count; n++) {
      invAdd(resultado.id, resultado.count);
      consumirIngredientes();
      recalcularResultado();
    }
  } else {
    // con algo en el cursor solo se puede sumar al mismo objeto (apilable) si entra
    if (cursor && (cursor.id !== resultado.id || cursor.count + resultado.count > maxPila(cursor.id))) return;
    if (cursor) cursor.count += resultado.count; else cursor = nuevaPila(resultado.id, resultado.count);
    consumirIngredientes();
  }
  recalcularResultado();
  refreshInventoryUI();
}

// ---------- abrir / cerrar ----------
function lockPointer() {
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}
// lado = 2: el inventario (tecla E) · 3: la mesa de crafteo (click derecho sobre ella)
function openInventory(lado = 2) {
  craftLado = lado;
  actualizarPaneles();
  invOpen = true;
  invEl.style.display = 'flex';
  hotbarEl.style.display = 'none';
  document.exitPointerLock();
  mouse.left = mouse.right = false;
  refreshInventoryUI();
}
function closeInventory() {
  if (cursor) {                                                    // lo que tengas en la mano vuelve a la mochila
    const left = creative ? 0 : invAdd(cursor.id, cursor.count, cursor.dano);
    if (left > 0) dropFromPlayer(cursor.id, left, cursor.dano);
    cursor = null;
  }
  for (let k = 0; k < craft.length; k++) {                         // y lo que dejaste en la grilla de crafteo tambien
    const s = craft[k];
    if (!s) continue;
    const left = invAdd(s.id, s.count, s.dano);
    if (left > 0) dropFromPlayer(s.id, left, s.dano);
    craft[k] = null;
  }
  resultado = null;
  invOpen = false;
  invEl.style.display = 'none';
  hotbarEl.style.display = 'flex';
  tipEl.style.display = 'none';
  cursorEl.style.display = 'none';
  lockPointer();
}
// Click fuera del panel con algo en el cursor: tirarlo al suelo
invEl.addEventListener('mousedown', e => {
  if (!cursor) return;
  const n = e.button === 2 ? 1 : cursor.count;
  if (!creative) dropFromPlayer(cursor.id, n, cursor.dano);
  cursor.count -= n;
  if (cursor.count <= 0) cursor = null;
  refreshInventoryUI();
});
window.addEventListener('mousemove', e => {
  cursorEl.style.left = e.clientX - 22 + 'px';
  cursorEl.style.top = e.clientY - 22 + 'px';
  tipEl.style.left = e.clientX + 14 + 'px';
  tipEl.style.top = e.clientY + 14 + 'px';
});

// ---------- refrescar todo ----------
let shownHandId = -1;
function refreshInventoryUI() {
  for (let i = 0; i < 9; i++) {
    renderSlot(hudSlots[i], inventory[i]);
    hudSlots[i].classList.toggle('sel', i === selected);
  }
  if (invOpen) {
    for (let i = 0; i < 36; i++) renderSlot(invSlots[i], inventory[i]);
    recalcularResultado();
    (craftLado === 3 ? celdas3 : celdas2).forEach((el, k) => renderSlot(el, craft[k]));
    renderSlot(resultEl, resultado);
  }
  if (cursor) { renderSlot(cursorEl, cursor); cursorEl.style.display = 'block'; }
  else cursorEl.style.display = 'none';
  const id = heldId();                                              // lo que sostiene la mano
  if (id !== shownHandId) { shownHandId = id; setHandBlock(id); }
}

function selectSlot(i) {
  selected = i;
  refreshInventoryUI();
  toast(heldId() ? itemInfo(heldId()).name : '');
}

// ---------- objetos soltados en el mundo ----------
const dropMaterial = new THREE.MeshBasicMaterial({ map: atlasTexture, vertexColors: true, alphaTest: 0.5 });
const dropGeos = {};
const drops = [];

function spawnDrop(id, count, x, y, z, vx = 0, vy = 3, vz = 0, dano) {
  if (drops.length > 120) { const o = drops.shift(); scene.remove(o.mesh); }
  const plano = esItem(id);                                       // los objetos (manzana, herramientas) son planos; los bloques, cubos
  const mesh = new THREE.Mesh(dropGeos[id] || (dropGeos[id] = plano ? makeItemGeometry(id) : makeBlockGeometry(id)), plano ? itemMaterial(id) : dropMaterial);
  mesh.scale.setScalar(plano ? 0.4 : 0.28);
  scene.add(mesh);
  drops.push({ id, count, dano, x, y, z, vx, vy, vz, age: 0, ph: Math.random() * 6.28, mesh, alto: plano ? 0.22 : 0.12 });   // alto: a que altura del piso flota
}
function dropFromPlayer(id, count, dano) {
  const d = lookDir();
  spawnDrop(id, count, camera.position.x + d[0] * 0.6, camera.position.y - 0.3, camera.position.z + d[2] * 0.6,
    d[0] * 5, d[1] * 4 + 2, d[2] * 5, dano);
}
// Lo que suelta un bloque roto
function dropForBlock(b, x, y, z) {
  if (creative) return;
  const def = BLOCKS[b];
  if (def.extra && Math.random() <= def.extra.chance)                // objeto extra (manzana de las hojas), se tira aparte
    spawnDrop(def.extra.id, 1, x + 0.5, y + 0.5, z + 0.5, (Math.random() - 0.5) * 2, 2.5, (Math.random() - 0.5) * 2);
  if (def.dropChance !== undefined && Math.random() > def.dropChance) return;
  spawnDrop(def.drop || b, 1, x + 0.5, y + 0.5, z + 0.5, (Math.random() - 0.5) * 2, 2.5, (Math.random() - 0.5) * 2);
}

function updateDrops(dt) {
  dropMaterial.color.setScalar(Math.max(0.4, daylight));
  const p = player.pos;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.age += dt;
    if (d.age > 300) { scene.remove(d.mesh); drops.splice(i, 1); continue; }

    const dx = p.x - d.x, dy = p.y + 0.9 - d.y, dz = p.z - d.z;
    const dist = Math.hypot(dx, dy, dz);
    if (d.age > 0.7 && dist < 2.6 && invCanAdd(d.id) && !creative) {   // el iman los atrae
      const sp = Math.min(dist, (10 - dist * 2.5) * dt + 3 * dt);
      d.x += dx / dist * sp; d.y += dy / dist * sp; d.z += dz / dist * sp;
      d.vx = d.vy = d.vz = 0;
      if (dist < 0.7) {
        const left = invAdd(d.id, d.count, d.dano);
        if (left === 0) { scene.remove(d.mesh); drops.splice(i, 1); continue; }
        d.count = left;
      }
    } else {
      d.vy -= 20 * dt;
      const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt, nz = d.z + d.vz * dt;
      if (isSolidB(getBlock(Math.floor(d.x), Math.floor(ny - 0.14), Math.floor(d.z)))) {
        d.y = Math.floor(ny - 0.14) + 1 + 0.14; d.vy = 0;
        const f = Math.exp(-8 * dt); d.vx *= f; d.vz *= f;
      } else d.y = ny;
      if (!isSolidB(getBlock(Math.floor(nx), Math.floor(d.y), Math.floor(d.z)))) d.x = nx; else d.vx *= -0.3;
      if (!isSolidB(getBlock(Math.floor(d.x), Math.floor(d.y), Math.floor(nz)))) d.z = nz; else d.vz *= -0.3;
      if (isSolidB(getBlock(Math.floor(d.x), Math.floor(d.y), Math.floor(d.z)))) d.y += 1;   // quedo dentro de un bloque
    }
    d.mesh.position.set(d.x, d.y + d.alto + Math.sin(d.age * 2.4 + d.ph) * 0.05, d.z);
    d.mesh.rotation.y = d.age * 1.6;
  }
}

// ---------- inicio ----------
setCreative(creative);
toastEl.style.opacity = 0;
if (!creative) CONFIG.startKit.forEach(([id, n]) => invAdd(id, n));
else ITEM_IDS.forEach((id, i) => { inventory[i] = { id, count: maxPila(id) }; });
refreshInventoryUI();

const resultadoCraft = () => resultado;           // lo que se fabricaria ahora con la grilla (para las pruebas)

export { inventory, craft, resultadoCraft, invAdd, heldId, consumeHeld, gastarHerramienta, selected, creative, selectSlot, invOpen, openInventory, closeInventory, hotkeySwap, toast, lockPointer, setCreative, dropForBlock, updateDrops, drops, spawnDrop };
