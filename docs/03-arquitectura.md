# 03 · Arquitectura

> Última revisión: 2026-11-19 · Corresponde al código después de completar la Fase 1 (salud, varios mundos y menú). Hay cambios sin commitear desde `398be37`.
> Este documento está pensado para dárselo a una IA al empezar una sesión. Los nombres de archivos y funciones salen del código real.

## Vista general

```
Electron (main.js)  ──abre ventana──▶  index.html  ──carga──▶  src/game.js  ──importa──▶  el resto de src/*.js
   proceso principal                    HTML + CSS + canvas     (módulo de entrada)         (módulos ES)
```

- **`main.js`** (38 líneas): crea la ventana de 1280×720, carga `index.html`, registra el guardado (`guardado-main.js`) y, al cerrar la ventana, le pide al juego que guarde y espera su aviso (máximo 3 segundos). F12 abre las herramientas de desarrollador. Usa `contextIsolation: true`.
- **`preload.js`** (17 líneas): el puente entre la página y Electron. Expone solo `window.guardado` con `listar`, `cargar(id)`, `guardar(id, estado)`, `borrar(id)` y `alCerrar`; la página no recibe acceso a Node ni a archivos.
- **`guardado-main.js`** (118 líneas): lee y escribe los mundos (una carpeta por mundo), valida los ids, migra la partida de la versión anterior y arma la lista del menú. Lo usan `main.js` y `test/run.js`.
- **`index.html`**: define toda la interfaz (hotbar, inventario, mira, corazones y muslos, cartel de muerte, menú principal, textos) con HTML/CSS, un *import map* para `three` y el único `<script type="module" src="src/game.js">`.
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
guardado.js ─▶ inventory, sky, world, player, config
salud.js ─▶ inventory, player, config
menu.js ─▶ (nada: solo usa window.guardado y el HTML)
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
| `player.js` | `player` (posición, velocidad y también vida, hambre, punto de aparición…), `mouse`, `lookDir` | — |
| `world.js` | `chunks`, `savedChunks`, `chunkKey`, `heightAt`, `getBlock`, `setBlock`, `updateChunks`, `resetLoadRadius`, `FACES`, `QUV`, `waterMaterial`, `windUniform` | `config`, `textures`, `scene` |
| `quality.js` | `applyQuality` | `config`, `scene`, `world` |
| `sky.js` | `skyMesh`, `updateSky`, `daylight`, `setTime`, `skipTime`, `clockString` | `config`, `textures`, `scene`, `world` |
| `effects.js` | `hand`, `setHandBlock`, `updateHand`, `startSwing`, `makeBlockGeometry`, `pixelBox`, `SKIN`, `SHIRT`, partículas y grietas | `config`, `textures`, `scene`, `world`, `sky` |
| `character.js` | `thirdPerson`, `setThirdPerson`, `updateCharacter(player, dt, …)` | `scene`, `effects` |
| `inventory.js` | `inventory`, `invAdd`, `heldId`, `consumeHeld`, `selected`, `selectSlot`, `invOpen`, `openInventory`, `closeInventory`, `toast`, `setCreative`, `drops`, `spawnDrop`, `dropForBlock`, `updateDrops`, … | `config`, `textures`, `scene`, `world`, `sky`, `effects`, `player` |
| `salud.js` | `danar`, `curar`, `comer`, `gastar`, `alAterrizar`, `actualizarSalud`, `resetearSalud`, `reaparecer`, `MAX` | `config`, `inventory`, `player` |
| `menu.js` | `mostrarMenu` | — |
| `guardado.js` | `mundoId`, `cargarPartida`, `guardarPartida`, `iniciarGuardado`, `volverAlMenu` | `config`, `world`, `sky`, `inventory`, `player` |
| `game.js` | — (es la entrada; arma `window.mc`) | todos |

## Mapa de archivos

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `src/config.js` | 90 | Valores ajustables y definición de bloques y objetos (ver abajo). |
| `src/textures.js` | 245 | Dibuja todas las texturas con canvas 2D: ruido tileable, ruido celular. Arma un atlas de 12 tiles. |
| `src/scene.js` | 63 | Renderer WebGL, cámaras, luz del sol/luna con sombras, resolución adaptativa. |
| `src/quality.js` | 34 | Presets de calidad (alta/media/baja) aplicados en caliente con la tecla K. |
| `src/player.js` | 25 | Estado compartido del jugador (incluida la salud) y del mouse, y hacia dónde mira. |
| `src/salud.js` | 161 | Vida, hambre, daño por caída, muerte y reaparición, y la barra de corazones y muslos. |
| `src/menu.js` | 82 | Menú principal: lista, crea y borra mundos. |
| `src/world.js` | 391 | Terreno, chunks, árboles, acceso a bloques, generación de mallas, carga/descarga. |
| `src/sky.js` | 165 | Domo de cielo con shader, nubes, ciclo día/noche, la luz y la cámara de sombras. |
| `src/effects.js` | 172 | Partículas, grietas al romper, mano animada. |
| `src/character.js` | 94 | Cuerpo del jugador visible en tercera persona. |
| `src/inventory.js` | 348 | Datos y UI del inventario, drops en el mundo. |
| `src/guardado.js` | 110 | Arma y aplica el estado de la partida (qué se guarda), el mundo elegido por la dirección, el autoguardado y el botón "Guardar y volver al menú". |
| `src/game.js` | 388 | Entrada del juego: física del jugador (incluida la caída), raycast, controles, minado/colocación/comer, bucle `frame()`, arranque (muestra el menú o carga el mundo antes de generarlo). |
| `test/run.js` | 151 | `npm test`: abre el juego en Electron sin ventana, corre las pruebas (también reiniciando el juego, creando y borrando mundos) y devuelve código 0 o 1. Usa una carpeta temporal. No es parte del juego. |
| `test/pruebas.js` | 444 | Las pruebas del juego en marcha, que se ejecutan dentro de la página. |
| `test/pruebas-reinicio.js` | 72 | Las pruebas que se ejecutan después de reiniciar el juego (¿volvió la partida?). |
| `test/pruebas-menu.js` | 136 | Las pruebas del menú principal, los varios mundos y la migración. |

## Modelo de datos

### Bloques (`config.js`)

`BLOCKS` es un objeto por **id numérico** (1–10 son bloques del mundo, el 11 es la manzana, que es un objeto; 0 es aire):

```js
1: { name: 'Césped', tiles: [0, 2, 1], hardness: 0.5, drop: 2 }
//      nombre       [arriba, abajo, lados]  segundos para romper   qué suelta
```

- `tiles`: índices en el atlas de texturas.
- `drop`: id del bloque que suelta (por defecto, el mismo). `dropChance`: probabilidad (por defecto 1).
- `extra: { id, chance }`: además de lo anterior, suelta otro objeto con esa probabilidad (las hojas dan manzanas, 3%).
- `food: n`: objeto que **no se pone** y se come con click derecho, devolviendo `n` de hambre (la manzana, 4). Es el único caso hoy de un "objeto que no es bloque": se dibuja como cubo con su textura hasta que haya objetos planos (Fase 2).
- `ITEM_IDS` es la lista de lo que puede estar en el inventario y en el catálogo creativo (1–9 y 11; el agua queda afuera).
- `isSolidB` (se puede chocar/apuntar: todo menos aire y agua) e `isOpaque` (tapa caras vecinas: todo menos aire, hojas y agua) son las dos reglas físicas y visuales.

**Para agregar un bloque** hay que tocar: `BLOCKS` y `ITEM_IDS` en `config.js`, una textura en `textures.js` y subir `NTILES`, y el arreglo `OPAQUE` de `world.js` (hoy se llena con un bucle `for b = 1..9`, así que un id nuevo no entra solo).

### Chunks (`world.js`)

- Constantes: `CS = 16` (ancho y largo), `H = 64` (alto).
- Cada chunk: `{ cx, cz, data: Uint8Array(16*64*16), maxY, mesh, waterMesh, meshed, modified }`. `modified` se pone en `true` la primera vez que `setBlock` lo toca.
- `savedChunks` (un `Map` con la misma clave) guarda los chunks modificados que se descargaron. Si se vuelve a necesitar uno, `generateChunk` lo devuelve desde ahí en vez de regenerarlo. Es también lo que se escribe en el archivo de la partida y lo que se rellena al cargarla.
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

### Salud (`salud.js`)

- Los datos están en el objeto `player` (`player.js`): `vida` y `hambre` (0 a 20), `saturacion`, `agotamiento`, `muerto`, y para las caídas `fallMax` (lo más alto que estuvo desde que dejó el suelo) y `lastY`. También `spawn` (el punto de aparición del mundo) y `ajustarSpawn`.
- `game.js` llama a `gastar(n)` cuando hay actividad (correr, saltar, nadar, romper), a `alAterrizar(distancia)` al tocar el suelo, y a `actualizarSalud(dt)` en cada cuadro (con `dt = 0` si el juego está en pausa, así la comida y la vida no avanzan).
- **Caída:** en `physicsStep`, `fallMax` sube mientras está en el aire y se reinicia al volar, estar en el agua o **teletransportarse** (un salto de más de 2 bloques en un solo paso). Al aterrizar, `alAterrizar(fallMax − y)` resta `ceil(distancia − 3)`.
- **Muerte:** `danar` llega a 0 → `morir`: marca `player.muerto`, muestra `#muerte` y suelta el mouse. Con `player.muerto` el juego no hace física ni deja romper o poner. `reaparecer` restaura la salud, lo mueve a `player.spawn` y marca `ajustarSpawn` para que `physicsStep` lo suba si quedó dentro de un bloque.
- **Punto de aparición:** `buscarSpawn()` en `game.js` (tierra firme cerca de (8, 8)); se guarda con la partida.
- **Barra:** 10 corazones y 10 muslos como `<img>` con iconos dibujados por código (3 estados cada uno), que se vuelven a pintar solo cuando cambia el valor.
- Con `creative` activo no se aplica nada y la barra se oculta.

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
- Chunks a más de `renderDistance + 2` se **eliminan** de `chunks`. Si estaban modificados pasan antes a `savedChunks`; los que no, se regeneran desde la semilla cuando hacen falta. El disco se maneja aparte (ver "Guardado en disco" más abajo).

## Guardado en disco

Tres piezas, una en cada lado de Electron:

```
página (src/guardado.js, src/menu.js) ──window.guardado──▶ preload.js ──IPC──▶ main.js / guardado-main.js ──▶ mundos\<id>\
   arma y aplica el estado, el menú        el puente                          lee y escribe los archivos     en %APPDATA%\minicraft
```

### Qué mundo se juega

El mundo lo elige **la dirección de la página** (`guardado.js` lee `location.search`); el menú y el botón de volver recargan la página con otros parámetros, así cada mundo arranca desde cero sin restos del anterior:

| Dirección | Qué pasa |
|---|---|
| sin `?mundo=` (en Electron) | `game.js` muestra el menú (`menu.js`) y no carga ningún mundo |
| `?mundo=<id>` | carga ese mundo; si no existe todavía, empieza uno nuevo con ese id |
| `&semilla=N` | semilla del terreno (solo para un mundo nuevo; si no, 1337) |
| `&nombre=texto` | nombre que se ve en el menú (solo para un mundo nuevo) |

Sin `window.guardado` (por ejemplo, en un navegador) no hay menú ni guardado y el juego arranca directo.

### Archivos de cada mundo

`%APPDATA%\minicraft\mundos\<id>\`: `mundo.json.gz` (la partida), `mundo.respaldo.json.gz` y `meta.json` (`nombre`, `semilla`, `creado`, `ultimaVez`, para armar el menú sin abrir cada partida).

- **El `<id>` solo admite `[a-z0-9-]` (hasta 40).** `carpetaMundo()` en `guardado-main.js` lo valida y lanza un error si no cumple: la página manda el id y no debe poder apuntar a otra carpeta (`../`) ni borrar fuera de `mundos\`. Todos los canales IPC pasan por ahí.
- **Canales IPC:** `mundo:listar`, `mundo:cargar(id)`, `mundo:guardar(id, estado)`, `mundo:borrar(id)` (borra la carpeta entera) y `mundo:guardar-ahora` / `mundo:guardado-listo` para el cierre.
- **Migración:** al listar, si hay un `mundo.json.gz` suelto en `%APPDATA%\minicraft\` (la partida única de la versión anterior), `migrarAntiguo` lo mueve a `mundos\mundo-1\` con el nombre "Mi mundo" y la semilla que tenía. No pisa nada si `mundo-1` ya existe.

### El estado guardado

`guardarPartida()` arma: `version` (1), `nombre`, `semilla`, `hora`, `creativo`, `seleccionado`, `inventario` (36 casillas `{id, count}` o `null`), `vida`, `hambre`, `saturacion`, `spawn`, `jugador` (`x, y, z, yaw, pitch, vuela`) y `chunks` (lista de `{cx, cz, maxY, data}`, con solo los modificados).

- **En disco:** JSON comprimido con gzip; cada `data` (16384 bytes por chunk) va en base64. La conversión la hace `guardado-main.js`, así la página maneja `Uint8Array` directamente.
- **Cargar:** en `game.js`, `cargarPartida()` se llama **antes de generar chunks**, porque cambia la semilla, rellena `savedChunks` y deja al jugador donde estaba. Si no hay partida, la semilla sale de `&semilla=` y el jugador aparece en `buscarSpawn()`.
- **Compatibilidad hacia atrás:** los campos de salud, `spawn` y `nombre` son opcionales. Una partida sin ellos arranca con vida y hambre llenas. Si se cerró el juego en la pantalla de muerte (`vida` 0), se reaparece en el inicio. **Agregar campos opcionales no obliga a subir `VERSION`.**
- **Cuándo se guarda:** cada 30 segundos, al cerrar la ventana (`main.js` pide guardar y espera `mundo:guardado-listo`, con un tope de 3 segundos; el menú responde enseguida porque no tiene nada que guardar), al volver al menú y una vez al crear un mundo (para que aparezca en la lista desde el primer momento).
- **Escritura atómica:** se escribe `mundo.json.gz.tmp` y se renombra.
- **Respaldo:** al cargar bien el archivo principal se copia a `mundo.respaldo.json.gz`. Si el principal está dañado se usa el respaldo, y este no se pisa. Si ninguno sirve, se empieza un mundo nuevo.
- **Volver al menú:** `volverAlMenu()` guarda, pone `bloqueado = true` (nada vuelve a escribir) y recarga la página sin parámetros.
- **Si cambiás el formato de forma incompatible:** subir `VERSION` en `src/guardado.js` **y** en `guardado-main.js` (tienen que coincidir). Una versión desconocida se trata como "no hay partida"; para conservar las partidas viejas hay que escribir una migración.
- **Las pruebas no tocan tus mundos:** `test/run.js` usa una carpeta temporal.

## Bucle principal (`game.js`, `frame()`)

En cada frame, en este orden:

1. Cargar chunks (`updateChunks`).
2. Física del jugador, partida en pasos de 1/90 s máximo (`physicsStep`).
3. Cámara: balanceo, FOV, posición (y tercera persona con raycast para no atravesar bloques).
4. `updateSky`: cielo, niebla, luz y cámara de sombras.
5. Raycast (`raycast`, algoritmo DDA) al bloque apuntado.
6. Romper (`updateMining`) y poner o comer (`placeBlock`).
7. Partículas, drops, mano, personaje.
   (La salud, `actualizarSalud(dt)`, se actualiza justo después de la física.)
8. Efecto bajo el agua.
9. Dibujar mundo, y la mano en una segunda pasada encima.
10. Medir FPS y, si está activado, ajustar la resolución.

## Física del jugador

- Caja de colisión de 0.6 × 1.8 (`W`, `PH`). Ojos a 1.62.
- Se mueve y colisiona **un eje por vez** (x, z, y) en `moveAxis`.
- Salto: `jumpSpeed 8.6` con `gravity 28` da unos 1.3 bloques de altura. No hay "subir escalón" automático.
- En agua: velocidad al 55%, poca gravedad, mucho roce, y Espacio nada hacia arriba.
- **Caída y hambre** se calculan en el mismo `physicsStep`: ver "Salud" más arriba.

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
| Vida, hambre, daño, comida, la barra de corazones | `salud.js` (reglas y barra), `game.js` (qué actividades dan hambre), `config.js` (`hambre`, `danoCaida`) y `index.html` (estilos) |
| El menú de mundos | `menu.js` + `index.html` (estilos y el contenedor `#menu`) |
| Qué se guarda en la partida | `guardado.js` (estado) y `guardado-main.js` (archivo) |
| Lo que la página puede pedirle a Electron | `preload.js` (y el handler en `guardado-main.js`/`main.js`) |

## Puntos frágiles a tener en cuenta

Leídos del código; no son bugs confirmados, sino lugares donde un cambio puede romper algo:

- **Dependencias circulares:** hoy no hay y las reglas de arriba las evitan. Si un archivo "de abajo" necesita algo de uno "de arriba", la solución es pasarlo por parámetro o mover código, no importar en círculo.
- **Reasignar lo importado** (`daylight = …` desde otro archivo) da error en el navegador. Usar un objeto o una función, como `shadow.dirty`.
- **`OPAQUE` en `world.js`** se arma con un bucle fijo de ids 1 a 9. Un bloque nuevo con id distinto necesita ajustarlo.
- **`NTILES = 12` y el atlas** son números sueltos que deben coincidir con las texturas dibujadas.
- **El id 11 (manzana) no es un bloque del mundo**: nunca debería terminar en `chunks`. Cualquier objeto nuevo con `food` o similar tiene que pasar por `placeBlock` antes de poder ponerse.
- **Los teletransportes** (un cambio de posición de más de 2 bloques en un paso) reinician el conteo de caída. Si agregás una forma de moverse mucho en un paso, tené en cuenta que no cuenta como caída.
- **Todo corre en un solo hilo.** Cualquier trabajo pesado nuevo (más generación, mobs, guardado) puede notarse en los FPS.
- **Las pruebas (`npm test`) no ven el aspecto ni el mouse real.** Detalle y límites en [06-checklist-pruebas.md](06-checklist-pruebas.md#pruebas-automáticas-npm-test).
