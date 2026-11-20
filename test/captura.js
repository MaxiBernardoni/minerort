// ============================================================
// captura.js - Saca capturas del juego para MIRARLAS: `npm run captura` (o `npm run captura -- mano-bloque,suelo`).
// Abre el juego en Electron sin ventana, arma cada escena y guarda un PNG en la carpeta capturas/ (no se commitea).
// Sirve para revisar el aspecto de lo que dibuja el juego: las pruebas (npm test) comprueban que las cosas existen y
// funcionan, pero no pueden decir si se ven bien. Despues de cambiar algo visual, sacá la captura y mirala.
// Usa un mundo temporal: no toca tus mundos.
//
// Escenas: mano-bloque, mano-piedra, mano-manzana, mano-vacia, mano-pico, mano-hacha, mano-pala, suelo, inventario, barra, herramientas, crafteo, mesa-ui, creativo, mesa, sprites, pantalla, bloques-nuevos, agua, cueva, cabana, bioma-llanura, bioma-bosque, bioma-desierto, bioma-nevado, mobs, mobs-lado, mano-espada. (Sin argumentos: todas.)
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
    js: `mc.setCreative(true); { const P = mc.player, CX = 72, CZ = 40, PY = 60;
      for (let x = CX - 5; x <= CX + 5; x++) for (let z = CZ - 5; z <= CZ + 5; z++) { mc.setBlock(x, PY, z, 3); for (let y = PY + 1; y <= PY + 3; y++) mc.setBlock(x, y, z, 0); }
      P.pos.set(CX + 0.5, PY + 1.01, CZ + 0.5); P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = -0.75; P.fallMax = P.lastY = P.pos.y;
      mc.spawnDrop(100, 1, CX + 0.1, PY + 1.2, CZ - 1.3, 0, 0, 0); mc.spawnDrop(7, 1, CX + 0.9, PY + 1.2, CZ - 1.3, 0, 0, 0); }`,
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
      c.height = 3 * (16 * 9 + 8) + 8;
      c.style.cssText = 'position:fixed;left:0;top:0;background:#7da86a;z-index:99;image-rendering:pixelated';
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120].forEach((id, i) => g.drawImage(mc.itemSprites[id], 8 + (i % 8) * (16 * 9 + 8), 8 + Math.floor(i / 8) * (16 * 9 + 8), 16 * 9, 16 * 9));
      document.body.appendChild(c);`,
    despues: `document.getElementById('spritesTmp').remove();`, rect: { x: 0, y: 0, width: 1240, height: 480 },
  },
  // La mesa de crafteo puesta en el mundo, sobre una plataforma despejada
  mesa: {
    js: `{ const P = mc.player, CX = 72, CZ = 40, PY = 60;
      for (let x = CX - 5; x <= CX + 5; x++) for (let z = CZ - 5; z <= CZ + 5; z++) { mc.setBlock(x, PY, z, 3); for (let y = PY + 1; y <= PY + 3; y++) mc.setBlock(x, y, z, 0); }
      mc.setBlock(CX, PY + 1, CZ - 2, 11); mc.setBlock(CX + 1, PY + 1, CZ - 2, 7);
      P.pos.set(CX + 0.5, PY + 1.01, CZ + 0.5); P.vel.set(0, 0, 0); P.yaw = 0.35; P.pitch = -0.3; P.fallMax = P.lastY = P.pos.y;
      mc.selectSlot(8); }`,
    rect: { x: 240, y: 60, width: 800, height: 560 },
  },
  'mano-espada': { js: 'mc.inventory[5] = { id: 119, count: 1 }; mc.selectSlot(5);', rect: MANO },
  // Los tres mobs en fila sobre la plataforma: de frente y de perfil (miran hacia -Z; con yaw = PI miran a la camara)
  mobs: {
    js: `{ const P = mc.player, CX = 72, CZ = 40, PY = 60; mc.CONFIG.mobs = false; mc.mobs.slice().forEach(mc.quitarMob); mc.setTime(0.25);
      for (let x = CX - 5; x <= CX + 5; x++) for (let z = CZ - 5; z <= CZ + 5; z++) { mc.setBlock(x, PY, z, 3); for (let y = PY + 1; y <= PY + 3; y++) mc.setBlock(x, y, z, 0); }
      [['cerdo', -2.4], ['vaca', 0], ['zombi', 2.4]].forEach(([t, dx]) => { const m = mc.spawnMob(t, CX + 0.5 + dx, PY + 1.01, CZ - 1.5); m.yaw = Math.PI; m.caminando = false; m.t = 1000; });
      P.pos.set(CX + 0.5, PY + 1.01, CZ + 3.5); P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = -0.12; P.fallMax = P.lastY = P.pos.y;
      mc.selectSlot(8); }`,
    despues: `mc.mobs.slice().forEach(mc.quitarMob); mc.setTime(0.25);`, rect: { x: 100, y: 60, width: 1080, height: 600 },
  },
  'mobs-lado': {
    js: `{ const P = mc.player, CX = 72, CZ = 40, PY = 60; mc.CONFIG.mobs = false; mc.mobs.slice().forEach(mc.quitarMob); mc.setTime(0.25);
      for (let x = CX - 5; x <= CX + 5; x++) for (let z = CZ - 5; z <= CZ + 5; z++) { mc.setBlock(x, PY, z, 3); for (let y = PY + 1; y <= PY + 3; y++) mc.setBlock(x, y, z, 0); }
      [['cerdo', -2.4], ['vaca', 0], ['zombi', 2.4]].forEach(([t, dx]) => { const m = mc.spawnMob(t, CX + 0.5 + dx, PY + 1.01, CZ - 1.5); m.yaw = -Math.PI / 2; m.caminando = false; m.t = 1000; });
      P.pos.set(CX + 0.5, PY + 1.01, CZ + 3.5); P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = -0.12; P.fallMax = P.lastY = P.pos.y;
      mc.selectSlot(8); }`,
    despues: `mc.mobs.slice().forEach(mc.quitarMob);`, rect: { x: 100, y: 60, width: 1080, height: 600 },
  },
  // Los bloques nuevos de la Fase 3 en fila sobre la plataforma
  'bloques-nuevos': {
    js: `{ const P = mc.player, CX = 72, CZ = 40, PY = 60;
      for (let x = CX - 5; x <= CX + 5; x++) for (let z = CZ - 5; z <= CZ + 5; z++) { mc.setBlock(x, PY, z, 3); for (let y = PY + 1; y <= PY + 3; y++) mc.setBlock(x, y, z, 0); }
      [12, 13, 14, 15, 16, 4].forEach((id, i) => { mc.setBlock(CX - 3 + i, PY + 1, CZ - 2, id); });
      P.pos.set(CX + 0.5, PY + 1.01, CZ + 2.5); P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = -0.35; P.fallMax = P.lastY = P.pos.y;
      mc.selectSlot(8); }`,
    rect: { x: 140, y: 120, width: 1000, height: 440 },
  },
  // Agua que fluye: una fuente en la plataforma, con las cascadas por el borde
  agua: {
    js: `{ const P = mc.player, CX = 72, CZ = 40, PY = 60;
      for (let x = CX - 5; x <= CX + 5; x++) for (let z = CZ - 5; z <= CZ + 5; z++) { mc.setBlock(x, PY, z, 3); for (let y = PY + 1; y <= PY + 3; y++) mc.setBlock(x, y, z, 0); }
      mc.setBlock(CX - 2, PY + 1, CZ - 2, 10); for (let i = 0; i < 60; i++) mc.pasoAgua();
      P.pos.set(CX + 0.5, PY + 1.01, CZ + 4.5); P.vel.set(0, 0, 0); P.yaw = -0.5; P.pitch = -0.6; P.fallMax = P.lastY = P.pos.y;
      mc.selectSlot(8); }`,
    despues: `mc.setBlock(72 - 2, 61, 40 - 2, 0); for (let i = 0; i < 200; i++) mc.pasoAgua();`,
    rect: { x: 140, y: 60, width: 1000, height: 600 },
  },
  // Dentro de una cueva real del mundo (se busca un tunel de 6+ bloques de largo y mas de 6 de profundidad)
  cueva: {
    js: `(async () => {
      const P = mc.player; let sitio = null;
      for (const ch of mc.chunks.values()) { if (sitio) break;
        for (let z = 2; z < 14 && !sitio; z++) for (let x = 2; x < 14 && !sitio; x++) {
          const h = mc.heightAt(ch.cx * 16 + x, ch.cz * 16 + z);
          for (let y = 8; y < h - 7 && !sitio; y++) {
            const wx = ch.cx * 16 + x, wz = ch.cz * 16 + z;
            if (mc.getBlock(wx, y, wz) !== 0 || mc.getBlock(wx, y + 1, wz) !== 0 || mc.getBlock(wx, y - 1, wz) === 0) continue;
            for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              let n = 0; while (n < 8 && mc.getBlock(wx + dx * (n + 1), y, wz + dz * (n + 1)) === 0 && mc.getBlock(wx + dx * (n + 1), y + 1, wz + dz * (n + 1)) === 0) n++;
              if (n >= 6) { sitio = { wx, y, wz, yaw: Math.atan2(-dx, -dz) }; break; }
            }
          }
        } }
      if (!sitio) return 'no se encontro un tunel';
      P.pos.set(sitio.wx + 0.5, sitio.y + 0.01, sitio.wz + 0.5); P.vel.set(0, 0, 0); P.yaw = sitio.yaw; P.pitch = -0.1; P.fallMax = P.lastY = P.pos.y;
      mc.selectSlot(8);
      return 'cueva en ' + sitio.wx + ',' + sitio.y + ',' + sitio.wz;
    })()`,
    rect: { x: 0, y: 0, width: 1280, height: 720 },
  },
  cabana: {
    js: `(async () => {
      const P = mc.player; let cab = null;
      for (let gx = -12; gx <= 12 && !cab; gx++) for (let gz = -12; gz <= 12 && !cab; gz++) cab = mc.cabanaEn(gx, gz);
      P.pos.set(cab.x + 3.5, mc.heightAt(cab.x + 3, cab.z + 13) + 1.01, cab.z + 13.5); P.vel.set(0, 0, 0); P.yaw = 0.35; P.pitch = -0.12; P.fallMax = P.lastY = P.pos.y;
      await new Promise(r => { const t0 = Date.now(); (function w() { const c = mc.chunks.get(mc.chunkKey(Math.floor((cab.x + 3) / 16), Math.floor((cab.z + 3) / 16))); if ((c && c.meshed) || Date.now() - t0 > 12000) r(); else setTimeout(w, 100); })(); });
      mc.selectSlot(8);
      return 'cabana en ' + cab.x + ',' + cab.y + ',' + cab.z;
    })()`,
    rect: { x: 0, y: 0, width: 1280, height: 720 },
  },
};
// Un paisaje de cada bioma: se va al medio de uno (hay que mirar el cielo y el suelo, no solo bloques sueltos)
for (const [nombre, id] of [['llanura', 0], ['bosque', 1], ['desierto', 2], ['nevado', 3]]) {
  ESCENAS['bioma-' + nombre] = {
    js: `(async () => {
      const P = mc.player; let sitio = null;
      for (let cx = -60; cx <= 60 && !sitio; cx += 3) for (let cz = -60; cz <= 60 && !sitio; cz += 3) {
        const x = cx * 16 + 8, z = cz * 16 + 8, h = mc.heightAt(x, z);
        if (mc.biomeAt(x, z) === ${id} && h > mc.CONFIG.seaLevel + 3 && h < 44 && [[-3, 0], [3, 0], [0, -3], [0, 3]].every(([dx, dz]) => mc.biomeAt(x + dx * 16, z + dz * 16) === ${id})) sitio = { x, z, h };
      }
      P.pos.set(sitio.x + 0.5, sitio.h + 1.01, sitio.z + 0.5); P.vel.set(0, 0, 0); P.yaw = 0.6; P.pitch = -0.12; P.fallMax = P.lastY = P.pos.y;
      await new Promise(r => { const t0 = Date.now(); (function w() { if ([...mc.chunks.values()].filter(c => c.meshed).length > 150 || Date.now() - t0 > 15000) r(); else setTimeout(w, 150); })(); });
      mc.selectSlot(8);
      return 'bioma en ' + sitio.x + ',' + sitio.z;
    })()`,
    rect: { x: 0, y: 0, width: 1280, height: 720 },
  };
}

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
      const r = await js(escena.js);
      if (typeof r === 'string') console.log('  ' + r);
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
