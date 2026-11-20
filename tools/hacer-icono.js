// Dibuja el icono del juego (un bloque de cesped de 16x16 pixeles, ampliado) y lo guarda en build/icon.png.
// Es codigo, no una imagen externa: `node tools/hacer-icono.js` lo regenera. electron-builder lo convierte en .ico solo.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const N = 16, ESCALA = 32, TAM = N * ESCALA;                 // 512x512
const hash = (x, y, s) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const mezclar = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// Color de cada pixel del bloque: cesped arriba (con flecos que bajan) y tierra abajo, con un borde oscuro
function color(x, y) {
  if (x === 0 || y === 0 || x === N - 1 || y === N - 1) return [38, 28, 18];
  const fleco = 4 + Math.floor(hash(x, 0, 7) * 3);
  if (y <= fleco) return mezclar([58, 122, 34], [116, 182, 64], hash(x, y, 1));
  return mezclar([94, 64, 40], [138, 98, 66], hash(x, y, 2));
}

// Imagen RGBA, con esquinas redondeadas transparentes
const filas = [];
for (let py = 0; py < TAM; py++) {
  const fila = Buffer.alloc(1 + TAM * 4);                      // el primer byte es el filtro (0 = ninguno)
  for (let px = 0; px < TAM; px++) {
    const [r, g, b] = color(Math.floor(px / ESCALA), Math.floor(py / ESCALA));
    const dx = Math.max(0, 40 - px, px - (TAM - 41)), dy = Math.max(0, 40 - py, py - (TAM - 41));
    const afuera = dx * dx + dy * dy > 40 * 40;
    fila.set([r, g, b, afuera ? 0 : 255], 1 + px * 4);
  }
  filas.push(fila);
}

function trozo(tipo, datos) {
  const cabeza = Buffer.alloc(8);
  cabeza.writeUInt32BE(datos.length, 0); cabeza.write(tipo, 4, 'latin1');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(tipo, 'latin1'), datos])) >>> 0, 0);
  return Buffer.concat([cabeza, datos, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(TAM, 0); ihdr.writeUInt32BE(TAM, 4); ihdr[8] = 8; ihdr[9] = 6;   // 8 bits, RGBA
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(Buffer.concat(filas))), trozo('IEND', Buffer.alloc(0)),
]);
const destino = path.join(__dirname, '..', 'build', 'icon.png');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, png);
console.log(`build/icon.png (${TAM}x${TAM}, ${png.length} bytes)`);
