// ============================================================
// inventory.js - Inventario (36 espacios), barra rapida, pantalla de inventario
// con arrastrar/soltar, y objetos que caen al suelo y se recogen.
//   - Espacios 0-8 = barra rapida, 9-35 = mochila.
//   - E abre/cierra. Click: agarrar/soltar. Click der.: mitad / uno. Shift+click: mover rapido.
//   - Pasar el mouse sobre un espacio y apretar 1-9 lo manda a la barra.
//   - Modo creativo: catalogo de todos los bloques, sin gastar bloques.
// ============================================================

const MAX_STACK = 64;
const inventory = new Array(36).fill(null);     // cada espacio: null o { id, count }
let selected = 0;                               // espacio activo de la barra
let cursor = null;                              // pila que se esta arrastrando
let invOpen = false;
let creative = CONFIG.creative;
let hoverSlot = null;                           // espacio bajo el mouse (para las teclas 1-9)

const heldId = () => (inventory[selected] ? inventory[selected].id : 0);

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
  return inventory.some(s => !s || (s.id === id && s.count < MAX_STACK));
}
// Agrega items (barra primero, despues mochila). Devuelve lo que no entro.
function invAdd(id, count) {
  for (let i = 0; i < 36 && count > 0; i++) {
    const s = inventory[i];
    if (s && s.id === id && s.count < MAX_STACK) { const n = Math.min(MAX_STACK - s.count, count); s.count += n; count -= n; }
  }
  for (let i = 0; i < 36 && count > 0; i++) {
    if (!inventory[i]) { const n = Math.min(MAX_STACK, count); inventory[i] = { id, count: n }; count -= n; }
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

const title = document.createElement('div');
title.className = 'invTitle';
title.innerHTML = '<h2>Inventario</h2>';
title.appendChild(modeBtn);

const catalogLabel = Object.assign(document.createElement('div'), { className: 'invLabel', textContent: 'Catálogo creativo (click: 64 · click der.: 1)' });
const catalogGrid = Object.assign(document.createElement('div'), { className: 'grid' });
const storageLabel = Object.assign(document.createElement('div'), { className: 'invLabel', textContent: 'Mochila' });
const storageGrid = Object.assign(document.createElement('div'), { className: 'grid' });
const hotbarLabel = Object.assign(document.createElement('div'), { className: 'invLabel', textContent: 'Barra rápida' });
const hotbarGrid = Object.assign(document.createElement('div'), { className: 'grid' });
const hint = Object.assign(document.createElement('div'), {
  className: 'invHint',
  textContent: 'Click: mover · Click der.: mitad / uno · Shift+click: mover rápido · 1-9 sobre un espacio: pasar a la barra · Click afuera: tirar · E / Esc: cerrar',
});
panel.append(title, catalogLabel, catalogGrid, storageLabel, storageGrid, hotbarLabel, hotbarGrid, hint);

const invSlots = new Array(36);     // elementos DOM de la pantalla
function attachSlot(el, index) {
  invSlots[index] = el;
  el.addEventListener('mousedown', e => { e.stopPropagation(); slotClick(index, e); });
  el.addEventListener('mouseenter', () => { hoverSlot = index; showTip(inventory[index]); });
  el.addEventListener('mouseleave', () => { hoverSlot = null; tipEl.style.display = 'none'; });
}
for (let i = 9; i < 36; i++) { const el = makeSlotEl('islot'); attachSlot(el, i); storageGrid.appendChild(el); }
for (let i = 0; i < 9; i++) { const el = makeSlotEl('islot'); attachSlot(el, i); hotbarGrid.appendChild(el); }

const catalogSlots = [];
ITEM_IDS.forEach(id => {
  const el = makeSlotEl('islot');
  renderSlot(el, { id, count: 1 });
  el.lastChild.textContent = '';
  el.addEventListener('mousedown', e => {
    e.stopPropagation();
    if (cursor) cursor = null;                                    // soltar sobre el catalogo = borrar
    else cursor = { id, count: e.button === 2 ? 1 : MAX_STACK };
    refreshInventoryUI();
  });
  el.addEventListener('mouseenter', () => showTip({ id, count: 1 }));
  el.addEventListener('mouseleave', () => { tipEl.style.display = 'none'; });
  catalogGrid.appendChild(el);
  catalogSlots.push(el);
});

function showTip(stack) {
  if (!stack) { tipEl.style.display = 'none'; return; }
  tipEl.textContent = BLOCKS[stack.id].name + (stack.count > 1 ? ' ×' + stack.count : '');
  tipEl.style.display = 'block';
}

function setCreative(v) {
  creative = v;
  modeBtn.textContent = creative ? 'Modo: Creativo' : 'Modo: Supervivencia';
  catalogLabel.style.display = catalogGrid.style.display = creative ? '' : 'none';
  toast(creative ? 'Modo creativo' : 'Modo supervivencia');
  refreshInventoryUI();
}

// ---------- clicks sobre los espacios ----------
function slotClick(i, e) {
  const s = inventory[i], right = e.button === 2;
  if (e.shiftKey && !right) {                                      // mover rapido barra <-> mochila
    if (s) {
      const [from, to] = i < 9 ? [9, 36] : [0, 9];
      const left = moveInto(s, from, to);
      inventory[i] = left > 0 ? { id: s.id, count: left } : null;
    }
  } else if (!right) {
    if (!cursor) { if (s) { cursor = s; inventory[i] = null; } }
    else if (!s) { inventory[i] = cursor; cursor = null; }
    else if (s.id === cursor.id) {
      const n = Math.min(MAX_STACK - s.count, cursor.count);
      s.count += n; cursor.count -= n;
      if (cursor.count <= 0) cursor = null;
    } else { inventory[i] = cursor; cursor = s; }
  } else {
    if (!cursor) {
      if (s) {
        const half = Math.ceil(s.count / 2);
        cursor = { id: s.id, count: half };
        s.count -= half;
        if (s.count <= 0) inventory[i] = null;
      }
    } else if (!s) { inventory[i] = { id: cursor.id, count: 1 }; if (--cursor.count <= 0) cursor = null; }
    else if (s.id === cursor.id && s.count < MAX_STACK) { s.count++; if (--cursor.count <= 0) cursor = null; }
  }
  showTip(inventory[i]);
  refreshInventoryUI();
}

// Mete una pila en el rango [from, to) del inventario. Devuelve lo que no entro.
function moveInto(stack, from, to) {
  let count = stack.count;
  for (let i = from; i < to && count > 0; i++) {
    const s = inventory[i];
    if (s && s.id === stack.id && s.count < MAX_STACK) { const n = Math.min(MAX_STACK - s.count, count); s.count += n; count -= n; }
  }
  for (let i = from; i < to && count > 0; i++) {
    if (!inventory[i]) { const n = Math.min(MAX_STACK, count); inventory[i] = { id: stack.id, count: n }; count -= n; }
  }
  return count;
}

// 1-9 con el mouse sobre un espacio: intercambia con ese espacio de la barra
function hotkeySwap(n) {
  if (hoverSlot === null || hoverSlot === n) return;
  [inventory[hoverSlot], inventory[n]] = [inventory[n], inventory[hoverSlot]];
  refreshInventoryUI();
}

// ---------- abrir / cerrar ----------
function lockPointer() {
  try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}
function openInventory() {
  invOpen = true;
  invEl.style.display = 'flex';
  hotbarEl.style.display = 'none';
  document.exitPointerLock();
  mouse.left = mouse.right = false;
  refreshInventoryUI();
}
function closeInventory() {
  if (cursor) {                                                    // lo que tengas en la mano vuelve a la mochila
    const left = creative ? 0 : invAdd(cursor.id, cursor.count);
    if (left > 0) dropFromPlayer(cursor.id, left);
    cursor = null;
  }
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
  if (!creative) dropFromPlayer(cursor.id, n);
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
  if (invOpen) for (let i = 0; i < 36; i++) renderSlot(invSlots[i], inventory[i]);
  if (cursor) { renderSlot(cursorEl, cursor); cursorEl.style.display = 'block'; }
  else cursorEl.style.display = 'none';
  const id = heldId();                                              // lo que sostiene la mano
  if (id !== shownHandId) { shownHandId = id; setHandBlock(id); }
}

function selectSlot(i) {
  selected = i;
  refreshInventoryUI();
  toast(heldId() ? BLOCKS[heldId()].name : '');
}

// ---------- objetos soltados en el mundo ----------
const dropMaterial = new THREE.MeshBasicMaterial({ map: atlasTexture, vertexColors: true, alphaTest: 0.5 });
const dropGeos = {};
const drops = [];

function spawnDrop(id, count, x, y, z, vx = 0, vy = 3, vz = 0) {
  if (drops.length > 120) { const o = drops.shift(); scene.remove(o.mesh); }
  const mesh = new THREE.Mesh(dropGeos[id] || (dropGeos[id] = makeBlockGeometry(id)), dropMaterial);
  mesh.scale.setScalar(0.28);
  scene.add(mesh);
  drops.push({ id, count, x, y, z, vx, vy, vz, age: 0, ph: Math.random() * 6.28, mesh });
}
function dropFromPlayer(id, count) {
  const d = lookDir();
  spawnDrop(id, count, camera.position.x + d[0] * 0.6, camera.position.y - 0.3, camera.position.z + d[2] * 0.6,
    d[0] * 5, d[1] * 4 + 2, d[2] * 5);
}
// Lo que suelta un bloque roto
function dropForBlock(b, x, y, z) {
  if (creative) return;
  const def = BLOCKS[b];
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
        const left = invAdd(d.id, d.count);
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
    d.mesh.position.set(d.x, d.y + 0.12 + Math.sin(d.age * 2.4 + d.ph) * 0.05, d.z);
    d.mesh.rotation.y = d.age * 1.6;
  }
}

// ---------- inicio ----------
setCreative(creative);
toastEl.style.opacity = 0;
if (!creative) CONFIG.startKit.forEach(([id, n]) => invAdd(id, n));
else ITEM_IDS.forEach((id, i) => { inventory[i] = { id, count: MAX_STACK }; });
refreshInventoryUI();
