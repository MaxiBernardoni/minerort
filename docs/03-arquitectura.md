# 03 · Arquitectura

> Última revisión: 2026-11-19 · Corresponde al código posterior a la migración a módulos ES (commit `398be37` más los cambios de esa sesión).
> Este documento está pensado para dárselo a una IA al empezar una sesión. Los nombres de archivos y funciones salen del código real.

## Vista general

```
Electron (main.js)  ──abre ventana──▶  index.html  ──carga──▶  src/game.js  ──importa──▶  el resto de src/*.js
   proceso principal                    HTML + CSS + canvas     (módulo de entrada)         (módulos ES)
```

- **`main.js`** (22 líneas): solo crea la ventana de 1280×720 y carga `index.html`. F12 abre las herramientas de desarrollador. Usa `contextIsolation: true` y no hay `preload`.
- **`index.html`**: define toda la interfaz (hotbar, inventario, mira, textos) con HTML/CSS, un *import map* para `three` y el único `<script type="module" src="src/game.js">`.
- **`src/*.js`**: todo el juego. Corre en el navegador, no en Node.

## Decisión clave: módulos ES, sin bundler

Desde 2026-11-19 los archivos de `src/` son **módulos ES**: cada uno declara qué importa (`import`) y qué ofrece (`export { … }` al final del archivo). Ya no hay variables globales compartidas ni orden de carga que respetar.

- **Three.js:** se importa con `import * as THREE from 'three'`. El *import map* de `index.html` apunta `three` a `node_modules/three/build/three.module.js`. La versión **0.149.0 sigue fijada**: subirla cambia cómo se calcula la iluminación (desde r155) y parte de la API, así que es un paso aparte que hay que probar mirando el juego. `THREE` ya no existe como global.
- **No hay paso de compilación:** el navegador carga los módulos tal cual. Se edita y se reinicia.
- **Sin dependencias circulares.** Se evitaron a propósito (ver las reglas abajo).
- **Un módulo no puede reasignar lo que importa.** Si un valor cambia desde otro archivo se expone como objeto (`shadow.dirty`), como función (`resetLoadRadius()`, `fogFar()`) o se modifica una propiedad (`player.pos`, `mouse.left`). Una variable exportada con `let` (como `daylight`, `selected`, `renderScale`) la pueden **leer** los demás y siempre ven el valor actual, pero solo la reasigna su propio archivo.
- **`window.mc`** sigue exponiendo el estado para la consola (F12).

### Reglas para agregar o mover código

1. Un archivo importa solo de archivos "más abajo" en el grafo de abajo. Si necesitás algo de un archivo "más arriba", pasalo por parámetro o movelo a un archivo de más abajo (así se hizo con `player.js` y `quality.js`).
2. Todo lo que otro archivo necesite va en el `export { … }` del final. Lo que no se exporta es privado.
3. Un archivo nuevo se usa agregando un `import` en el archivo que lo necesita; no hay que tocar `index.html`.

## Grafo de dependencias

Cada flecha es un `import`. De abajo (base) hacia arriba:

```
game.js ─▶ todos los de abajo
inventory.js ─▶ player, effects, sky, world, scene, textures, config
character.js ─▶ effects, scene
effects.js ─▶ sky, world, scene, textures, config
sky.js ─▶ world, scene, textures, config
quality.js ─▶ world, scene, config
world.js ─▶ scene, textures, config
player.js ─▶ three
scene.js ─▶ config
textures.js ─▶ config
config.js ─▶ (nada)
```

| Archivo | Exporta | Importa de |
|---|---|---|
| `config.js` | `CONFIG`, `QUALITY`, `BLOCKS`, `CS`, `H`, `WATER`, `LEAVES`, `ITEM_IDS`, `isSolidB`, `isOpaque` | — |
| `textures.js` | `atlasTexture`, `waterTexture`, `crackTextures`, `tileUV`, `tileAvg`, `makeBlockIcon`, `hash2`, `tn`, `smooth`, `lerp` | `config` |
| `scene.js` | `canvas`, `renderer`, `scene`, `camera`, `handScene`, `handCamera`, `sun`, `hemi`, `shadow`, `fogFar()`, `applyRenderScale`, `renderScale` | `config` |
| `player.js` | `player`, `mouse`, `lookDir` | — |
| `world.js` | `chunks`, `savedChunks`, `chunkKey`, `heightAt`, `getBlock`, `setBlock`, `updateChunks`, `resetLoadRadius`, `FACES`, `QUV`, `waterMaterial`, `windUniform` | `config`, `textures`, `scene` |
| `quality.js` | `applyQuality` | `config`, `scene`, `world` |
| `sky.js` | `skyMesh`, `updateSky`, `daylight`, `setTime`, `skipTime`, `clockString` | `config`, `textures`, `scene`, `world` |
| `effects.js` | `hand`, `setHandBlock`, `updateHand`, `startSwing`, `makeBlockGeometry`, `pixelBox`, `SKIN`, `SHIRT`, partículas y grietas | `config`, `textures`, `scene`, `world`, `sky` |
| `character.js` | `thirdPerson`, `setThirdPerson`, `updateCharacter(player, dt, …)` | `scene`, `effects` |
| `inventory.js` | `inventory`, `invAdd`, `heldId`, `consumeHeld`, `selected`, `selectSlot`, `invOpen`, `openInventory`, `closeInventory`, `toast`, `setCreative`, `drops`, `spawnDrop`, `dropForBlock`, `updateDrops`, … | `config`, `textures`, `scene`, `world`, `sky`, `effects`, `player` |
| `game.js` | — (es la entrada; arma `window.mc`) | todos |

## Mapa de archivos

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `src/config.js` | 83 | Valores ajustables y definición de bloques (ver abajo). |
| `src/textures.js` | 237 | Dibuja todas las texturas con canvas 2D: ruido tileable, ruido celular. Arma un atlas de 11 tiles. |
| `src/scene.js` | 63 | Renderer WebGL, cámaras, luz del sol/luna con sombras, resolución adaptativa. |
| `src/quality.js` | 34 | Presets de calidad (alta/media/baja) aplicados en caliente con la tecla K. |
| `src/player.js` | 19 | Estado compartido del jugador y del mouse, y hacia dónde mira. |
| `src/world.js` | 391 | Terreno, chunks, árboles, acceso a bloques, generación de mallas, carga/descarga. |
| `src/sky.js` | 165 | Domo de cielo con shader, nubes, ciclo día/noche, la luz y la cámara de sombras. |
| `src/effects.js` | 172 | Partículas, grietas al romper, mano animada. |
| `src/character.js` | 94 | Cuerpo del jugador visible en tercera persona. |
| `src/inventory.js` | 346 | Datos y UI del inventario, drops en el mundo. |
| `src/game.js` | 345 | Entrada del juego: física del jugador, raycast, controles, minado/colocación, bucle `frame()`, arranque. |

## Modelo de datos

### Bloques (`config.js`)

`BLOCKS` es un objeto por **id numérico** (1–10; 0 es aire):

```js
1: { name: 'Césped', tiles: [0, 2, 1], hardness: 0.5, drop: 2 }
//      nombre       [arriba, abajo, lados]  segundos para romper   qué suelta
```

- `tiles`: índices en el atlas de texturas.
- `drop`: id del bloque que suelta (por defecto, el mismo). `dropChance`: probabilidad (por defecto 1).
- `ITEM_IDS` es la lista de bloques que pueden estar en el inventario (1–9; el agua queda afuera).
- `isSolidB` (se puede chocar/apuntar: todo menos aire y agua) e `isOpaque` (tapa caras vecinas: todo menos aire, hojas y agua) son las dos reglas físicas y visuales.

**Para agregar un bloque** hay que tocar: `BLOCKS` y `ITEM_IDS` en `config.js`, una textura en `textures.js` y subir `NTILES`, y el arreglo `OPAQUE` de `world.js` (hoy se llena con un bucle `for b = 1..9`, así que un id nuevo no entra solo).

### Chunks (`world.js`)

- Constantes: `CS = 16` (ancho y largo), `H = 64` (alto).
- Cada chunk: `{ cx, cz, data: Uint8Array(16*64*16), maxY, mesh, waterMesh, meshed, modified }`. `modified` se pone en `true` la primera vez que `setBlock` lo toca.
- `savedChunks` (un `Map` con la misma clave) guarda los chunks modificados que se descargaron. Si se vuelve a necesitar uno, `generateChunk` lo devuelve desde ahí en vez de regenerarlo.
- Índice de un bloque en `data`: `y * 256 + z * 16 + x` (x, z locales de 0 a 15).
- `chunks` es un `Map`; la clave es `chunkKey(cx, cz)`.
- `getBlock(x, y, z)` y `setBlock(x, y, z, b)` toman coordenadas **de mundo**. Fuera del mundo hacia abajo devuelve sólido, hacia arriba aire, y en un chunk no cargado devuelve aire.
- `setBlock` reconstruye la malla del chunk y de los vecinos si el bloque está en un borde, y marca las sombras como sucias.

### Terreno

- `heightAt(x, z)`: mezcla dos capas de ruido de valor (`fbm`) para dar una altura entera por columna.
- `generateChunk`: rellena capas (césped/tierra/piedra o arena), agua hasta `seaLevel`, y planta árboles. Los árboles miran las columnas vecinas (±2) para que las copas crucen bordes de chunk de forma consistente.
- Todo sale de `hash2` con la semilla: **mismo seed = mismo mundo**.

### Inventario (`inventory.js`)

- `inventory`: arreglo de 36 espacios, cada uno `null` o `{ id, count }`. Espacios 0–8 = barra rápida.
- Estado del módulo: `selected` (espacio activo), `cursor` (pila arrastrada), `invOpen`, `creative`.
- La UI se redibuja con `refreshInventoryUI()` después de cada cambio.
- `drops`: objetos sueltos en el mundo (máximo 120, desaparecen a los 300 s).

## Cómo se dibuja el mundo

Es la parte más técnica; está en `world.js` (`buildChunkMesh`):

1. **Copia con borde:** antes de armar la malla, el chunk y 1 bloque de cada vecino se copian a un arreglo plano `pad` de 18×18×(H+2). Así consultar vecinos es una suma de índices, sin buscar en el `Map`.
2. **Eliminación de caras ocultas:** solo se genera una cara si el vecino no es opaco. Las caras entre dos bloques sólidos no existen.
3. **Ambient occlusion por vértice:** cada vértice se oscurece según los 3 bloques vecinos de su esquina (niveles en `AO_LEVELS`). La diagonal del cuadrado se elige para que el degradado no quede torcido.
4. **Hojas:** con `fancyLeaves` apagado, solo se dibujan las caras contra algo que no sea hoja. Un atributo por vértice (`sway`) las mece con un shader inyectado en `onBeforeCompile`.
5. **Agua:** va en una malla aparte, translúcida, con la cara superior más baja (0.88) salvo que haya agua encima.
6. **Buffers reutilizables:** los arreglos de vértices se reusan entre chunks y crecen si hace falta.

Cada chunk produce como máximo 2 mallas (sólidos y agua), que se agregan a `scene`.

### Carga y descarga (`updateChunks`)

- Se llama en cada frame con un **presupuesto**: máximo 4 chunks de datos, 3 mallas y 5 ms (`game.js` línea del bucle).
- Se generan datos en un radio de `renderDistance + 1`, y mallas en `renderDistance`, empezando por los más cercanos.
- Un chunk solo se mallea cuando sus 8 vecinos ya existen.
- Chunks a más de `renderDistance + 2` se **eliminan** de `chunks`. Si estaban modificados pasan antes a `savedChunks`; los que no, se regeneran desde la semilla cuando hacen falta. Nada se guarda en disco (ver [02-estado-actual.md](02-estado-actual.md)).

## Bucle principal (`game.js`, `frame()`)

En cada frame, en este orden:

1. Cargar chunks (`updateChunks`).
2. Física del jugador, partida en pasos de 1/90 s máximo (`physicsStep`).
3. Cámara: balanceo, FOV, posición (y tercera persona con raycast para no atravesar bloques).
4. `updateSky`: cielo, niebla, luz y cámara de sombras.
5. Raycast (`raycast`, algoritmo DDA) al bloque apuntado.
6. Romper (`updateMining`) y poner (`placeBlock`).
7. Partículas, drops, mano, personaje.
8. Efecto bajo el agua.
9. Dibujar mundo, y la mano en una segunda pasada encima.
10. Medir FPS y, si está activado, ajustar la resolución.

## Física del jugador

- Caja de colisión de 0.6 × 1.8 (`W`, `PH`). Ojos a 1.62.
- Se mueve y colisiona **un eje por vez** (x, z, y) en `moveAxis`.
- Salto: `jumpSpeed 8.6` con `gravity 28` da unos 1.3 bloques de altura. No hay "subir escalón" automático.
- En agua: velocidad al 55%, poca gravedad, mucho roce, y Espacio nada hacia arriba.

## Estado visible desde la consola

`window.mc` (al final de `game.js`) expone `CONFIG`, `player`, `chunks`, `inventory`, `getBlock`, `setBlock`, `setTime`, `applyQuality` y más. Sirve para probar cosas con F12 sin recompilar (ejemplo: `mc.setTime(0.25)`).

## Cómo pedirle cambios a la IA con esta estructura

El README original dice que la estructura está "pensada para pedirle cambios archivo por archivo". Mapa rápido de **a qué archivo ir según lo que quieras**:

| Quiero cambiar… | Archivo |
|---|---|
| Un número (velocidad, distancia, altura de nubes) | `config.js` |
| Un bloque nuevo o sus propiedades | `config.js` + `textures.js` |
| Cómo se ve una textura | `textures.js` |
| Cómo es el terreno, árboles, cuevas | `world.js` (`heightAt`, `generateChunk`) |
| Cielo, luz, hora | `sky.js` |
| Presets de calidad (alta/media/baja) | `config.js` (`QUALITY`) y `quality.js` |
| Algo del inventario | `inventory.js` (datos y UI) + `index.html` (estilos) |
| Controles, física, minado | `game.js` |
| Cómo se ve el personaje o la mano | `character.js` / `effects.js` |
| La ventana de Electron | `main.js` |

## Puntos frágiles a tener en cuenta

Leídos del código; no son bugs confirmados, sino lugares donde un cambio puede romper algo:

- **Dependencias circulares:** hoy no hay y las reglas de arriba las evitan. Si un archivo "de abajo" necesita algo de uno "de arriba", la solución es pasarlo por parámetro o mover código, no importar en círculo.
- **Reasignar lo importado** (`daylight = …` desde otro archivo) da error en el navegador. Usar un objeto o una función, como `shadow.dirty`.
- **`OPAQUE` en `world.js`** se arma con un bucle fijo de ids 1 a 9. Un bloque nuevo con id distinto necesita ajustarlo.
- **`NTILES = 11` y el atlas** son números sueltos que deben coincidir con las texturas dibujadas.
- **Todo corre en un solo hilo.** Cualquier trabajo pesado nuevo (más generación, mobs, guardado) puede notarse en los FPS.
- **No hay tests**, así que la única forma de verificar es jugar.
