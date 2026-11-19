# 03 · Arquitectura

> Última revisión: 2026-11-19 · Corresponde al commit `e69a868`.
> Este documento está pensado para dárselo a una IA al empezar una sesión. Los nombres de archivos y funciones salen del código real.

## Vista general

```
Electron (main.js)  ──abre ventana──▶  index.html  ──carga scripts en orden──▶  src/*.js
   proceso principal                    HTML + CSS + canvas                      juego en el navegador (Chromium)
```

- **`main.js`** (22 líneas): solo crea la ventana de 1280×720 y carga `index.html`. F12 abre las herramientas de desarrollador. Usa `contextIsolation: true` y no hay `preload`.
- **`index.html`**: define toda la interfaz (hotbar, inventario, mira, textos) con HTML/CSS, y carga los scripts.
- **`src/*.js`**: todo el juego. Corre en el navegador, no en Node.

## Decisión clave: scripts globales, sin módulos ni bundler

Los archivos de `src/` **no usan `import`/`export`**. Se cargan con etiquetas `<script>` y comparten variables y funciones **globales**. Consecuencias:

- **El orden de carga importa.** Un archivo solo puede usar lo definido en los anteriores (o dentro de funciones que se llaman más tarde).
- Three.js se carga como global `THREE` desde `node_modules/three/build/three.min.js`. **La versión 0.149.0 está fijada a propósito:** las versiones nuevas de Three.js eliminaron ese archivo `build/three.min.js`, así que actualizar rompe la carga. Para subir de versión hay que migrar a módulos ES primero.
- No hay paso de compilación: se edita y se reinicia.
- Contrapartida: cualquier cosa que nombre igual a otra global la pisa sin avisar.

## Orden de carga y dependencias

Orden en `index.html`:

| # | Archivo | Aporta | Usa de antes |
|---|---|---|---|
| 1 | `three.min.js` | `THREE` | — |
| 2 | `src/config.js` | `CONFIG`, `QUALITY`, `BLOCKS`, `CS`, `H`, `WATER`, `LEAVES`, `ITEM_IDS`, `isSolidB`, `isOpaque` | — |
| 3 | `src/textures.js` | Atlas de texturas (`atlasTexture`), `waterTexture`, `tileUV`, `makeBlockIcon`, funciones de ruido (`hash2`, `tn`, `smooth`, `lerp`…) | `CONFIG`, `THREE` |
| 4 | `src/scene.js` | `renderer`, `scene`, `camera`, `handScene`, luces (`sun`, `hemi`), `applyQuality`, `applyRenderScale`, `renderScale`, `shadowDirty` | `CONFIG`, `QUALITY`, `CS` |
| 5 | `src/world.js` | `chunks`, `heightAt`, `generateChunk`, `getBlock`, `setBlock`, `buildChunkMesh`, `updateChunks`, `chunkMaterial`, `waterMaterial`, `windUniform` | config, texturas, escena |
| 6 | `src/sky.js` | `skyMesh`, `updateSky`, `daylight`, `setTime`, `skipTime`, `clockString` | texturas (ruido), escena, `waterMaterial`, `windUniform` |
| 7 | `src/effects.js` | Partículas, grietas, mano en primera persona (`hand`, `setHandBlock`, `updateHand`, `makeBlockGeometry`) | textura, escena |
| 8 | `src/character.js` | Cuerpo del jugador y tercera persona (`thirdPerson`, `setThirdPerson`, `updateCharacter`) | escena |
| 9 | `src/inventory.js` | Inventario, hotbar, drops (`inventory`, `invAdd`, `heldId`, `consumeHeld`, `dropForBlock`, `updateDrops`, `toast`) | casi todo lo anterior |
| 10 | `src/game.js` | Jugador, física, entrada, bucle principal, arranque | todo |

> Regla práctica: si agregás un archivo, ubicalo en `index.html` después de los que necesita.

## Mapa de archivos

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `src/config.js` | 81 | Valores ajustables y definición de bloques (ver abajo). |
| `src/textures.js` | 232 | Dibuja todas las texturas con canvas 2D: ruido tileable, ruido celular. Arma un atlas de 11 tiles. |
| `src/scene.js` | 84 | Renderer WebGL, cámaras, luz del sol/luna con sombras, resolución adaptativa, presets de calidad. |
| `src/world.js` | 374 | Terreno, chunks, árboles, acceso a bloques, generación de mallas, carga/descarga. |
| `src/sky.js` | 157 | Domo de cielo con shader, nubes, ciclo día/noche, la luz y la cámara de sombras. |
| `src/effects.js` | 163 | Partículas, grietas al romper, mano animada. |
| `src/character.js` | 88 | Cuerpo del jugador visible en tercera persona. |
| `src/inventory.js` | 335 | Datos y UI del inventario, drops en el mundo. |
| `src/game.js` | 341 | Jugador, física, raycast, entrada, minado/colocación, bucle `frame()`, arranque. |

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
- Cada chunk: `{ cx, cz, data: Uint8Array(16*64*16), maxY, mesh, waterMesh, meshed }`.
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
- Estado global: `selected` (espacio activo), `cursor` (pila arrastrada), `invOpen`, `creative`.
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
- Chunks a más de `renderDistance + 2` se **eliminan** (ver limitación en [02-estado-actual.md](02-estado-actual.md)).

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
| Algo del inventario | `inventory.js` (datos y UI) + `index.html` (estilos) |
| Controles, física, minado | `game.js` |
| Cómo se ve el personaje o la mano | `character.js` / `effects.js` |
| La ventana de Electron | `main.js` |

## Puntos frágiles a tener en cuenta

Leídos del código; no son bugs confirmados, sino lugares donde un cambio puede romper algo:

- **Dependencia del orden de scripts y de globales** (ver arriba).
- **`OPAQUE` en `world.js`** se arma con un bucle fijo de ids 1 a 9. Un bloque nuevo con id distinto necesita ajustarlo.
- **`NTILES = 11` y el atlas** son números sueltos que deben coincidir con las texturas dibujadas.
- **Todo corre en un solo hilo.** Cualquier trabajo pesado nuevo (más generación, mobs, guardado) puede notarse en los FPS.
- **No hay tests**, así que la única forma de verificar es jugar.
