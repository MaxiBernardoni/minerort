// ============================================================
// config.js - Valores ajustables y definicion de bloques.
// Tocar estos numeros es la forma mas facil de experimentar.
// ============================================================

const CONFIG = {
  // --- mundo ---
  seed: 1337,            // cambia el mapa generado
  renderDistance: 6,     // en chunks (1 chunk = 16 bloques)
  seaLevel: 26,          // altura del agua
  treeChance: 0.012,     // probabilidad de arbol por columna

  // --- jugador ---
  gravity: 28,
  walkSpeed: 4.3,
  sprintSpeed: 6.5,
  flySpeed: 16,
  jumpSpeed: 8.6,
  reach: 6,              // alcance para romper/poner bloques
  mouseSensitivity: 0.0022,
  fov: 75,
  breakSpeed: 1,         // multiplicador de velocidad al romper (2 = el doble de rapido)
  viewBobbing: true,     // balanceo de camara y mano al caminar
  thirdPersonDistance: 3.6, // distancia de la camara en tercera persona (tecla V)

  // --- inventario ---
  creative: false,       // true = bloques infinitos y sin drops (se puede cambiar en el inventario)
  startKit: [[7, 16], [8, 8], [9, 8]],   // [bloque, cantidad] con los que empezas en supervivencia

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

// tiles: [cara de arriba, cara de abajo, caras laterales] -> indices del atlas (textures.js)
// hardness: segundos que tarda en romperse
// drop: que bloque suelta al romperse (por defecto, el mismo); dropChance: probabilidad (por defecto 1)
const BLOCKS = {
  1:  { name: 'Césped',   tiles: [0, 2, 1],   hardness: 0.5, drop: 2 },
  2:  { name: 'Tierra',   tiles: [2, 2, 2],   hardness: 0.45 },
  3:  { name: 'Piedra',   tiles: [3, 3, 3],   hardness: 1.1, drop: 9 },
  4:  { name: 'Madera',   tiles: [5, 5, 4],   hardness: 0.9 },
  5:  { name: 'Hojas',    tiles: [6, 6, 6],   hardness: 0.15, dropChance: 0.35 },
  6:  { name: 'Arena',    tiles: [7, 7, 7],   hardness: 0.4 },
  7:  { name: 'Tablones', tiles: [8, 8, 8],   hardness: 0.7 },
  8:  { name: 'Ladrillo', tiles: [9, 9, 9],   hardness: 1.2 },
  9:  { name: 'Adoquín',  tiles: [10, 10, 10], hardness: 1.2 },
  10: { name: 'Agua',     tiles: [0, 0, 0],   hardness: 0 },   // fluido, no solido
};
const WATER = 10, LEAVES = 5;

// Bloques que se pueden tener en el inventario (el catalogo del modo creativo)
const ITEM_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Reglas de colision y de dibujado
const isSolidB = b => b !== 0 && b !== WATER;                 // se puede chocar / apuntar
const isOpaque = b => b !== 0 && b !== LEAVES && b !== WATER; // tapa las caras vecinas
