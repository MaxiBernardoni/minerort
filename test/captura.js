// ============================================================
// captura.js - Saca capturas del juego para MIRARLAS: `npm run captura` (o `npm run captura -- mano-bloque,suelo`).
// Abre el juego en Electron sin ventana, arma cada escena y guarda un PNG en la carpeta capturas/ (no se commitea).
// Sirve para revisar el aspecto de lo que dibuja el juego: las pruebas (npm test) comprueban que las cosas existen y
// funcionan, pero no pueden decir si se ven bien. Despues de cambiar algo visual, sacá la captura y mirala.
// Usa un mundo temporal: no toca tus mundos.
//
// Escenas: mano-bloque, mano-piedra, mano-manzana, mano-vacia, mano-pico, mano-hacha, mano-pala, suelo, inventario, barra, herramientas, crafteo, mesa-ui, creativo, mesa, sprites, pantalla. (Sin argumentos: todas.)
// ============================================================
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { registrar } = require('../guardado-main.js');

const raiz = path.join(__dirname, '..');
const salida = path.join(raiz, 'capturas');
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'minicraft-captura-'));
registrar(ipcMain, () => base, () => {});
fs.mkdirSync(salida, { recursive: true });

const MANO = { x: 640, y: 300, width: 640, height: 420 };           // abajo a la derecha, donde esta el brazo
// Cada escena: codigo que se ejecuta dentro del juego, nombre del archivo y recorte (sin recorte = pantalla completa)
const ESCENAS = {
  'mano-bloque': { js: 'mc.inventory[0] = { id: 7, count: 16 }; mc.selectSlot(0);', rect: MANO },
  'mano-piedra': { js: 'mc.inventory[1] = { id: 3, count: 16 }; mc.selectSlot(1);', rect: MANO },
  'mano-manzana': { js: 'mc.inventory[2] = { id: 100, count: 3 }; mc.selectSlot(2);', rect: MANO },
  'mano-vacia': { js: 'mc.selectSlot(8);', rect: MANO },
  // Objetos en el suelo sobre una plataforma despejada. En creativo para que el iman del juego no los recoja antes de la foto.
  suelo: {
    js: `mc.setCreative(true); const P = mc.player, CX = 72, CZ = 40, PY = 60;
      for (let x = CX - 5; x <= CX + 5; x++) for (let z = CZ - 5; z <= CZ + 5; z++) { mc.setBlock(x, PY, z, 3); for (let y = PY + 1; y <= PY + 3; y++) mc.setBlock(x, y, z, 0); }
      P.pos.set(CX + 0.5, PY + 1.01, CZ + 0.5); P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = -0.75; P.fallMax = P.lastY = P.pos.y;
      mc.spawnDrop(100, 1, CX + 0.1, PY + 1.2, CZ - 1.3, 0, 0, 0); mc.spawnDrop(7, 1, CX + 0.9, PY + 1.2, CZ - 1.3, 0, 0, 0);`,
    despues: 'mc.setCreative(false);', rect: { x: 300, y: 250, width: 700, height: 400 },
  },
  inventario: { js: 'mc.inventory[3] = { id: 100, count: 5 }; mc.openInventory();', despues: 'mc.closeInventory();', rect: { x: 300, y: 80, width: 680, height: 560 } },
  barra: { js: 'mc.player.vida = 7; mc.player.hambre = 13; mc.inventory[0] = { id: 7, count: 16 }; mc.selectSlot(0);', rect: { x: 340, y: 600, width: 600, height: 120 } },
  pantalla: { js: 'mc.selectSlot(0);' },
  'mano-pico': { js: 'mc.inventory[5] = { id: 103, count: 1 }; mc.selectSlot(5);', rect: MANO },
  'mano-hacha': { js: 'mc.inventory[5] = { id: 104, count: 1 }; mc.selectSlot(5);', rect: MANO },
  'mano-pala': { js: 'mc.inventory[5] = { id: 106, count: 1 }; mc.selectSlot(5);', rect: MANO },
  // Todos los objetos nuevos en el inventario (el pico de madera con poco desgaste y el de piedra con mucho, para ver las barritas)
  herramientas: {
    js: `mc.inventory.fill(null); [101, 102, 103, 104, 105, 106, 107, 100].forEach((id, i) => { mc.inventory[i] = { id, count: id === 101 || id === 100 ? 8 : 1, dano: id === 102 ? 20 : id === 103 ? 100 : 0 }; });
      mc.inventory[9] = { id: 11, count: 4 }; mc.openInventory();`,
    despues: 'mc.closeInventory();', rect: { x: 300, y: 40, width: 680, height: 640 },
  },
  crafteo: { js: 'mc.inventory.fill(null); mc.craft[0] = { id: 4, count: 2 }; mc.invAdd(7, 16); mc.openInventory();', despues: 'mc.closeInventory();', rect: { x: 300, y: 40, width: 680, height: 640 } },
  'mesa-ui': {
    js: `mc.inventory.fill(null); mc.invAdd(7, 16); mc.invAdd(101, 8);
      [0, 1, 2].forEach(k => { mc.craft[k] = { id: 7, count: 1 }; }); [4, 7].forEach(k => { mc.craft[k] = { id: 101, count: 1 }; }); mc.openInventory(3);`,
    despues: 'mc.closeInventory();', rect: { x: 300, y: 20, width: 680, height: 680 },
  },
  creativo: { js: 'mc.setCreative(true); mc.openInventory();', despues: 'mc.closeInventory(); mc.setCreative(false);', rect: { x: 300, y: 40, width: 680, height: 640 } },
  // Los sprites de los objetos ampliados 9 veces (para retocar su dibujo)
  sprites: {
    js: `const c = document.createElement('canvas'); c.id = 'spritesTmp'; c.width = 8 * 16 * 9 + 9 * 8; c.height = 16 * 9 + 16;
      c.style.cssText = 'position:fixed;left:0;top:0;background:#7da86a;z-index:99;image-rendering:pixelated';
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      [100, 101, 102, 103, 104, 105, 106, 107].forEach((id, i) => g.drawImage(mc.itemSprites[id], 8 + i * (16 * 9 + 8), 8, 16 * 9, 16 * 9));
      document.body.appendChild(c);`,
    despues: `document.getElementById('spritesTmp').remove();`, rect: { x: 0, y: 0, width: 1240, height: 170 },
  },
  // La mesa de crafteo puesta en el mundo, sobre una plataforma despejada
  mesa: {
    js: `const P = mc.player, CX = 72, CZ = 40, PY = 60;
      for (let x = CX - 5; x <= CX + 5; x++) for (let z = CZ - 5; z <= CZ + 5; z++) { mc.setBlock(x, PY, z, 3); for (let y = PY + 1; y <= PY + 3; y++) mc.setBlock(x, y, z, 0); }
      mc.setBlock(CX, PY + 1, CZ - 2, 11); mc.setBlock(CX + 1, PY + 1, CZ - 2, 7);
      P.pos.set(CX + 0.5, PY + 1.01, CZ + 0.5); P.vel.set(0, 0, 0); P.yaw = 0.35; P.pitch = -0.3; P.fallMax = P.lastY = P.pos.y;
      mc.selectSlot(8);`,
    rect: { x: 240, y: 60, width: 800, height: 560 },
  },
};

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 1280, height: 720, show: false,
      webPreferences: { contextIsolation: true, offscreen: true, backgroundThrottling: false, preload: path.join(raiz, 'preload.js') },
    });
    win.webContents.on('console-message', (e, nivel, mensaje) => { if (nivel >= 3) console.log('[error en la consola del juego]', mensaje); });
    await win.loadFile(path.join(raiz, 'index.html'), { search: '?mundo=captura&semilla=1337' });
    const js = codigo => win.webContents.executeJavaScript(codigo);
    await new Promise(r => { const t0 = Date.now(); const w = async () => { const ok = await js('!!(window.mc && mc.chunks.size > 0)').catch(() => false); if (ok || Date.now() - t0 > 20000) r(); else setTimeout(w, 200); }; w(); });
    // Como en las pruebas: el bloqueo real del puntero no existe sin ventana, se maneja a mano
    await js(`window.addEventListener('pointerlockchange', e => e.stopImmediatePropagation(), true);
      mc.setLocked(true); document.getElementById('overlay').style.display = 'none'; mc.setTime(0.25); mc.player.pitch = -0.15; mc.player.yaw = 0.6;`);

    const pedidas = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2].split(',') : Object.keys(ESCENAS);
    for (const nombre of pedidas) {
      const escena = ESCENAS[nombre];
      if (!escena) { console.log(`escena desconocida: ${nombre} (las que hay: ${Object.keys(ESCENAS).join(', ')})`); continue; }
      await js(escena.js);
      await new Promise(r => setTimeout(r, 900));                      // deja dibujar unos cuadros
      const imagen = await win.webContents.capturePage(escena.rect);
      fs.writeFileSync(path.join(salida, nombre + '.png'), imagen.toPNG());
      console.log(`capturas/${nombre}.png`);
      if (escena.despues) await js(escena.despues);
    }
  } catch (e) {
    console.log('Error al sacar las capturas:', e.message);
  }
  fs.rmSync(base, { recursive: true, force: true });
  app.exit(0);
});
