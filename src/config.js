// ============================================================
// config.js - Valores ajustables y definicion de bloques.
// Tocar estos numeros es la forma mas facil de experimentar.
// ============================================================

const CONFIG = {
  // --- mundo ---
  seed: 1337,            // cambia el mapa generado
  renderDistance: 6,     // en chunks (1 chunk = 16 bloques)
  seaLevel: 26,          // altura del agua
  treeChance: 0.012,     // probabilidad de arbol por columna (el bosque tiene el triple, la llanura casi nada: ver K_ARBOL en world.js)
  mobs: true,            // false = sin cerdos, vacas ni zombis
  maxMobs: 12,           // cuantos mobs como maximo cerca del jugador (cada uno son unas 5 mallas: mas mobs cuesta FPS)
  luzMinima: 0.5,        // que tan clara es la oscuridad total bajo tierra (0 = negro, 1 = como afuera); sin antorchas, mas bajo es injugable
  luzPorBloque: 0.1,     // cuanto oscurece cada bloque de techo (hasta llegar a luzMinima)

  // --- jugador ---
  gravity: 28,
  walkSpeed: 4.3,
  sprintSpeed: 6.5,
  flySpeed: 16,
  jumpSpeed: 8.6,
  reach: 6,              // alcance para romper/poner bloques
  reachMobs: 3.5,        // alcance para pegarle a un mob
  mouseSensitivity: 0.0022,
  fov: 75,
  breakSpeed: 1,         // multiplicador de velocidad al romper (2 = el doble de rapido)
  viewBobbing: true,     // balanceo de camara y mano al caminar
  thirdPersonDistance: 3.6, // distancia de la camara en tercera persona (tecla V)

  // --- inventario ---
  creative: false,       // true = bloques infinitos y sin drops (se puede cambiar en el inventario)
  startKit: [[7, 16], [8, 8], [9, 8]],   // [bloque, cantidad] con los que empezas en supervivencia

  // --- salud (solo en supervivencia: en creativo no hay dano ni hambre) ---
  hambre: true,          // false = la comida nunca baja (la vida igual baja con dano)
  danoCaida: true,       // false = las caidas no duelen

  // --- graficos / rendimiento ---
  quality: 'media',      // 'alta' | 'media' | 'baja' (tecla K para cambiar en el juego)
  antialias: true,       // suavizado de bordes (MSAA); apagarlo da mas FPS
  adaptiveResolution: true, // baja la resolucion sola si los FPS caen, y la sube si sobran
  targetFPS: 58,
  minRenderScale: 0.55,  // lo minimo que puede bajar la resolucion (1 = nativa)
  // Los valores de abajo los pisa el preset de calidad (ver QUALITY mas abajo)
  shadows: true,         // sombras reales (tecla G para activar/desactivar)
  shadowMapSize: 1024,   // calidad de sombras (1024 / 2048 / 4096)
  shadowDistance: 40,    // radio alrededor del jugador que recibe sombras
  shadowUpdateEvery: 2,  // actualizar el mapa de sombras cada N frames (mas = mas FPS)
  shadowSoft: false,     // bordes de sombra suaves (mas caro)
  fancyLeaves: false,    // hojas con caras internas (mas bonito, mas caro)
  dayLength: 600,        // segundos que dura un dia completo
  startTime: 0.08,       // 0 = amanecer, 0.25 = mediodia, 0.5 = atardecer, 0.75 = medianoche
  cloudHeight: 105,
  cloudSpeed: 1.5,
};

// Presets de calidad: lo que cambia entre alta / media / baja
const QUALITY = {
  alta:  { shadows: true,  shadowMapSize: 2048, shadowDistance: 48, shadowUpdateEvery: 1, shadowSoft: true,  fancyLeaves: true,  renderDistance: 6 },
  media: { shadows: true,  shadowMapSize: 1024, shadowDistance: 40, shadowUpdateEvery: 2, shadowSoft: false, fancyLeaves: false, renderDistance: 6 },
  baja:  { shadows: false, shadowMapSize: 1024, shadowDistance: 32, shadowUpdateEvery: 3, shadowSoft: false, fancyLeaves: false, renderDistance: 4 },
};

const CS = 16;   // tamano de chunk (x y z)
const H = 64;    // altura del mundo

// Ids con nombre, para no escribir numeros sueltos (las recetas y los tests los usan).
// Los BLOQUES van del 1 al 99 y los OBJETOS (lo que no es bloque) desde el 100. Un bloque tambien es un objeto del
// inventario con su mismo id.
const ID = {
  MADERA: 4, TABLONES: 7, LADRILLO: 8, ADOQUIN: 9, MESA: 11,
  MINERAL_HIERRO: 12, MINERAL_DIAMANTE: 13, NIEVE: 14, CACTUS: 15, ABEDUL: 16,
  MANZANA: 100, PALO: 101,
  PICO_MADERA: 102, PICO_PIEDRA: 103, HACHA_MADERA: 104, HACHA_PIEDRA: 105, PALA_MADERA: 106, PALA_PIEDRA: 107,
  LINGOTE: 108, DIAMANTE: 109,
  PICO_HIERRO: 110, PICO_DIAMANTE: 111, HACHA_HIERRO: 112, HACHA_DIAMANTE: 113, PALA_HIERRO: 114, PALA_DIAMANTE: 115,
  CARNE: 116,
  ESPADA_MADERA: 117, ESPADA_PIEDRA: 118, ESPADA_HIERRO: 119, ESPADA_DIAMANTE: 120,
};

// ---------- Bloques: lo que existe en el mundo ----------
// tiles: [cara de arriba, cara de abajo, caras laterales] -> indices del atlas (textures.js)
// hardness: segundos que tarda en romperse con la mano
// drop: que suelta al romperse (por defecto, el mismo bloque); dropChance: probabilidad (por defecto 1)
// extra: { id, chance }: ademas, suelta otro objeto con esa probabilidad (las hojas dan manzanas)
// herramienta: la que lo rompe mas rapido ('pico', 'hacha' o 'pala')
// necesita: true = solo suelta algo si se rompe con esa herramienta (la piedra sin pico no da adoquin)
// nivel: material minimo de la herramienta (0 madera, 1 piedra, 2 hierro, 3 diamante); el mineral de diamante pide hierro
const BLOCKS = {
  1:  { name: 'Césped',   tiles: [0, 2, 1],   hardness: 0.5, drop: 2, herramienta: 'pala' },
  2:  { name: 'Tierra',   tiles: [2, 2, 2],   hardness: 0.45, herramienta: 'pala' },
  3:  { name: 'Piedra',   tiles: [3, 3, 3],   hardness: 1.1, drop: ID.ADOQUIN, herramienta: 'pico', necesita: true },
  4:  { name: 'Madera',   tiles: [5, 5, 4],   hardness: 0.9, herramienta: 'hacha' },
  5:  { name: 'Hojas',    tiles: [6, 6, 6],   hardness: 0.15, dropChance: 0.35, extra: { id: ID.MANZANA, chance: 0.03 } },
  6:  { name: 'Arena',    tiles: [7, 7, 7],   hardness: 0.4, herramienta: 'pala' },
  7:  { name: 'Tablones', tiles: [8, 8, 8],   hardness: 0.7, herramienta: 'hacha' },
  8:  { name: 'Ladrillo', tiles: [9, 9, 9],   hardness: 1.2, herramienta: 'pico', necesita: true },
  9:  { name: 'Adoquín',  tiles: [10, 10, 10], hardness: 1.2, herramienta: 'pico', necesita: true },
  10: { name: 'Agua',     tiles: [0, 0, 0],   hardness: 0 },   // fluido, no solido
  11: { name: 'Mesa de crafteo', tiles: [11, 8, 12], hardness: 0.9, herramienta: 'hacha' },   // click derecho: abre el crafteo 3x3
  12: { name: 'Mineral de hierro',   tiles: [13, 13, 13], hardness: 1.6, drop: ID.LINGOTE,  herramienta: 'pico', necesita: true, nivel: 1 },   // sin horno: suelta el lingote directo
  13: { name: 'Mineral de diamante', tiles: [14, 14, 14], hardness: 2.0, drop: ID.DIAMANTE, herramienta: 'pico', necesita: true, nivel: 2 },
  14: { name: 'Nieve',  tiles: [15, 15, 15], hardness: 0.3, herramienta: 'pala' },
  15: { name: 'Cactus', tiles: [19, 19, 18], hardness: 0.4 },
  16: { name: 'Abedul', tiles: [17, 17, 16], hardness: 0.9, herramienta: 'hacha' },
};
const WATER = 10, LEAVES = 5;
// Agua que fluye: 10 es la fuente y 20..26 son los niveles 1 (cerca de la fuente) a 7 (la punta).
for (let l = 1; l <= 7; l++) BLOCKS[19 + l] = { name: 'Agua', tiles: [0, 0, 0], hardness: 0 };
const isWater = b => b === WATER || (b >= 20 && b <= 26);
const nivelAgua = b => b === WATER ? 0 : b - 19;                               // 0 = fuente, 1..7 = fluyendo
const alturaAgua = b => 0.88 * (1 - nivelAgua(b) / 8);                         // fraccion del bloque que ocupa (si no hay agua arriba)

// ---------- Objetos: lo que NO es un bloque (no se pone en el mundo) ----------
// Su dibujo es un sprite de 16x16 con el mismo id en itemSprites (textures.js).
// food: se come con click derecho y devuelve esa cantidad de hambre
// tool: 'pico' | 'hacha' | 'pala'; velocidad: multiplicador al romper bloques de esa herramienta; dur: usos hasta romperse
// agarre: [x, y] pixel del sprite por donde la mano agarra la herramienta (cerca del extremo del mango)
const ITEMS = {
  [ID.MANZANA]: { name: 'Manzana', food: 4 },
  [ID.PALO]: { name: 'Palo' },
  [ID.PICO_MADERA]: { name: 'Pico de madera', tool: 'pico', velocidad: 2, dur: 59, agarre: [4, 11] },
  [ID.PICO_PIEDRA]: { name: 'Pico de piedra', tool: 'pico', velocidad: 4, dur: 131, agarre: [4, 11] },
  [ID.HACHA_MADERA]: { name: 'Hacha de madera', tool: 'hacha', velocidad: 2, dur: 59, agarre: [4, 11] },
  [ID.HACHA_PIEDRA]: { name: 'Hacha de piedra', tool: 'hacha', velocidad: 4, dur: 131, agarre: [4, 11] },
  [ID.PALA_MADERA]: { name: 'Pala de madera', tool: 'pala', velocidad: 2, dur: 59, agarre: [4, 11] },
  [ID.PALA_PIEDRA]: { name: 'Pala de piedra', tool: 'pala', velocidad: 4, dur: 131, agarre: [4, 11] },
  [ID.LINGOTE]: { name: 'Lingote de hierro' },
  [ID.DIAMANTE]: { name: 'Diamante' },
  [ID.CARNE]: { name: 'Carne', food: 6 },            // la sueltan cerdos y vacas (sin horno, se come cruda)
};
// Hierro y diamante. nivel = material de la herramienta (ver `nivel` de BLOCKS): madera 0, piedra 1, hierro 2, diamante 3
for (const [M, nombre, nivel, vel, dur] of [['HIERRO', 'hierro', 2, 6, 250], ['DIAMANTE', 'diamante', 3, 8, 1561]]) {
  ITEMS[ID['PICO_' + M]] = { name: 'Pico de ' + nombre, tool: 'pico', velocidad: vel, dur, agarre: [4, 11] };
  ITEMS[ID['HACHA_' + M]] = { name: 'Hacha de ' + nombre, tool: 'hacha', velocidad: vel, dur, agarre: [4, 11] };
  ITEMS[ID['PALA_' + M]] = { name: 'Pala de ' + nombre, tool: 'pala', velocidad: vel, dur, agarre: [4, 11] };
  for (const t of ['PICO_', 'HACHA_', 'PALA_']) ITEMS[ID[t + M]].nivel = nivel;
}
for (const [M, nivel] of [['MADERA', 0], ['PIEDRA', 1]]) for (const t of ['PICO_', 'HACHA_', 'PALA_']) ITEMS[ID[t + M]].nivel = nivel;
// Espadas: no rompen bloques mas rapido; pegan `danio` puntos de vida (la mano pega 1). Cada golpe gasta un uso.
for (const [M, nombre, danio, dur] of [['MADERA', 'madera', 4, 59], ['PIEDRA', 'piedra', 5, 131], ['HIERRO', 'hierro', 6, 250], ['DIAMANTE', 'diamante', 7, 1561]])
  ITEMS[ID['ESPADA_' + M]] = { name: 'Espada de ' + nombre, tool: 'espada', velocidad: 1, dur, danio, agarre: [2, 13] };

// Datos de un id de inventario, sea un bloque o un objeto
const itemInfo = id => BLOCKS[id] || ITEMS[id];

// Todo lo que puede estar en el inventario y en el catalogo del modo creativo (el agua no)
const ITEM_IDS = [...Object.keys(BLOCKS).map(Number).filter(b => !isWater(b)), ...Object.keys(ITEMS).map(Number)];

// Reglas de colision y de dibujado
const isSolidB = b => b !== 0 && !isWater(b);                 // se puede chocar / apuntar
const isOpaque = b => b !== 0 && b !== LEAVES && !isWater(b); // tapa las caras vecinas

export { CONFIG, QUALITY, CS, H, ID, BLOCKS, ITEMS, itemInfo, WATER, LEAVES, ITEM_IDS, isSolidB, isOpaque, isWater, nivelAgua, alturaAgua };
