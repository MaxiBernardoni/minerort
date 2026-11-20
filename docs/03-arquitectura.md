# 03 · Arquitectura

> Última revisión: 2026-11-20 · Corresponde al código después de completar la Fase 4 (mobs y combate; antes, la Fase 3: cuevas, minerales, biomas, agua que fluye y cabañas). Hay cambios sin commitear desde `76eb7fd` (la Fase 2).
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
agua.js ─▶ world, config
mobs.js ─▶ fisica, salud, inventory, effects, sky, world, scene, player, textures, config
fisica.js ─▶ world, config
guardado.js ─▶ inventory, sky, world, player, config
salud.js ─▶ inventory, player, config
menu.js ─▶ (nada: solo usa window.guardado y el HTML)
inventory.js ─▶ objetos, player, effects, sky, world, scene, textures, config
objetos.js ─▶ config
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
| `config.js` | `CONFIG`, `QUALITY`, `ID`, `BLOCKS`, `ITEMS`, `itemInfo`, `CS`, `H`, `WATER`, `LEAVES`, `ITEM_IDS`, `isSolidB`, `isOpaque`, `isWater`, `nivelAgua`, `alturaAgua` | — |
| `agua.js` | `tickAgua`, `pasoAgua` | `world`, `config` |
| `fisica.js` | `colisiona`, `moverEje` | `world`, `config` |
| `mobs.js` | `mobs`, `TIPOS`, `spawnMob`, `actualizarMobs`, `apuntarMob`, `golpear`, `quitar` | `fisica`, `salud`, `inventory`, `effects`, `sky`, `world`, `scene`, `player`, `textures`, `config` |
| `objetos.js` | `maxPila`, `RECETAS`, `buscarReceta`, `velocidadDeMinado`, `puedeRecoger`, `esHerramienta`, `MAX_PILA` | `config` |
| `textures.js` | `atlasTexture`, `waterTexture`, `crackTextures`, `itemSprites`, `tileUV`, `tileAvg`, `makeBlockIcon`, `hash2`, `tn`, `smooth`, `lerp` | `config` |
| `scene.js` | `canvas`, `renderer`, `scene`, `camera`, `handScene`, `handCamera`, `sun`, `hemi`, `shadow`, `fogFar()`, `applyRenderScale`, `renderScale` | `config` |
| `player.js` | `player` (posición, velocidad y también vida, hambre, punto de aparición…), `mouse`, `lookDir` | — |
| `world.js` | `chunks`, `savedChunks`, `chunkKey`, `generateChunk`, `heightAt`, `biomeAt`, `BIOMA`, `BIOMA_NOMBRE`, `esCueva`, `cabanaEn`, `getBlock`, `setBlock`, `rehacerMallas`, `activeWater`, `waterKey`, `chunkLoaded`, `updateChunks`, `resetLoadRadius`, `FACES`, `QUV`, `waterMaterial`, `windUniform` | `config`, `textures`, `scene` |
| `quality.js` | `applyQuality` | `config`, `scene`, `world` |
| `sky.js` | `skyMesh`, `updateSky`, `daylight`, `setTime`, `skipTime`, `clockString` | `config`, `textures`, `scene`, `world` |
| `effects.js` | `hand`, `setHandBlock`, `updateHand`, `startSwing`, `makeBlockGeometry`, `esItem`, `makeItemGeometry`, `itemMaterial`, `HAND_TIP_Z`, `pixelBox`, `SKIN`, `SHIRT`, partículas y grietas | `config`, `textures`, `scene`, `world`, `sky` |
| `character.js` | `thirdPerson`, `setThirdPerson`, `updateCharacter(player, dt, …)` | `scene`, `effects` |
| `inventory.js` | `inventory`, `craft`, `resultadoCraft`, `invAdd`, `heldId`, `consumeHeld`, `gastarHerramienta`, `selected`, `selectSlot`, `invOpen`, `openInventory(lado)`, `closeInventory`, `toast`, `setCreative`, `drops`, `spawnDrop`, `dropForBlock`, `updateDrops`, … | `config`, `objetos`, `textures`, `scene`, `world`, `sky`, `effects`, `player` |
| `salud.js` | `danar`, `curar`, `comer`, `gastar`, `alAterrizar`, `actualizarSalud`, `resetearSalud`, `reaparecer`, `MAX` | `config`, `inventory`, `player` |
| `menu.js` | `mostrarMenu` | — |
| `guardado.js` | `mundoId`, `cargarPartida`, `guardarPartida`, `iniciarGuardado`, `volverAlMenu` | `config`, `world`, `sky`, `inventory`, `player` |
| `game.js` | — (es la entrada; arma `window.mc`) | todos |

## Mapa de archivos

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `src/config.js` | 155 | Valores ajustables y definición de bloques (`BLOCKS`) y objetos (`ITEMS`) (ver abajo). |
| `src/objetos.js` | 80 | Las recetas de crafteo y las reglas de las herramientas (velocidad, qué suelta cada bloque, cuántos caben por casilla). Funciones puras. |
| `src/textures.js` | 449 | Dibuja todas las texturas con canvas 2D: ruido tileable, ruido celular. Arma un atlas de 20 tiles (los bloques) y los sprites planos de los objetos (manzana, palo, herramientas, lingote, diamante). |
| `src/scene.js` | 63 | Renderer WebGL, cámaras, luz del sol/luna con sombras, resolución adaptativa. |
| `src/quality.js` | 34 | Presets de calidad (alta/media/baja) aplicados en caliente con la tecla K. |
| `src/player.js` | 25 | Estado compartido del jugador (incluida la salud) y del mouse, y hacia dónde mira. |
| `src/salud.js` | 161 | Vida, hambre, daño por caída, muerte y reaparición, y la barra de corazones y muslos. |
| `src/menu.js` | 82 | Menú principal: lista, crea y borra mundos. |
| `src/agua.js` | 72 | El agua que fluye: cada celda activa mira a sus vecinos y toma su nivel (ver "Agua que fluye"). |
| `src/fisica.js` | 38 | El choque de una caja contra los bloques (`colisiona`, `moverEje`). Lo usan el jugador y los mobs. |
| `src/mobs.js` | 292 | Cerdo, vaca y zombi: modelos (cajas con color por vértice, unidas), IA, aparición cerca del jugador, y el combate (rayo contra las cajas, daño, empujón, botín). |
| `src/world.js` | 550 | Biomas, cuevas, minerales, cabañas, árboles, chunks, acceso a bloques, generación de mallas (con la luz del cielo) y carga/descarga. |
| `src/sky.js` | 165 | Domo de cielo con shader, nubes, ciclo día/noche, la luz y la cámara de sombras. |
| `src/effects.js` | 239 | Partículas, grietas al romper, mano animada, y el modelo de los objetos planos. |
| `src/character.js` | 94 | Cuerpo del jugador visible en tercera persona. |
| `src/inventory.js` | 500 | Datos y UI del inventario, crafteo (grillas de 2×2 y 3×3), desgaste de herramientas, catálogo creativo y objetos soltados en el mundo. |
| `src/guardado.js` | 110 | Arma y aplica el estado de la partida (qué se guarda), el mundo elegido por la dirección, el autoguardado y el botón "Guardar y volver al menú". |
| `src/game.js` | 395 | Entrada del juego: física del jugador (incluida la caída), raycast, controles, minado/colocación/comer, pegarle a los mobs, bucle `frame()`, arranque (muestra el menú o carga el mundo antes de generarlo). |
| `package.json` (campo `build`) | — | La configuración de electron-builder: qué archivos entran al paquete (`files`), el instalador (NSIS) y el icono. Los scripts `empaquetar`, `empaquetar:carpeta` y `probar-empaquetado`. |
| `build/icon.png` | — | El icono del juego (lo genera `tools/hacer-icono.js`). |
| `tools/hacer-icono.js` | 47 | Dibuja el icono por código (PNG escrito a mano con `zlib`). No es parte del juego. |
| `tools/probar-empaquetado.js` | 78 | Abre el juego empaquetado (o instalado) con datos temporales y comprueba que arranca, genera el mundo, guarda y no da errores. No es parte del juego. |
| `test/run.js` | 152 | `npm test`: abre el juego en Electron sin ventana, corre las pruebas (también reiniciando el juego, creando y borrando mundos) y devuelve código 0 o 1. Usa una carpeta temporal. No es parte del juego. |
| `test/pruebas.js` | 1047 | Las pruebas del juego en marcha, que se ejecutan dentro de la página. |
| `test/captura.js` | 196 | `npm run captura`: saca capturas del juego (mano, suelo, inventario, crafteo, mesa, barra, sprites ampliados, bloques nuevos, agua, una cueva, una cabaña, un paisaje de cada bioma y los mobs) para poder mirarlas. No es parte del juego. |
| `test/pruebas-reinicio.js` | 73 | Las pruebas que se ejecutan después de reiniciar el juego (¿volvió la partida?). |
| `test/pruebas-menu.js` | 140 | Las pruebas del menú principal, los varios mundos y la migración. |

## Modelo de datos

### Bloques y objetos (`config.js`)

Hay **dos registros**, y un mismo id numérico nunca está en los dos:

- **`BLOCKS`: lo que existe en el mundo.** Ids del **1 al 99** (hoy 1–16 y 20–26; el 10 es la **fuente** de agua; el 11 es la mesa de crafteo; 12 mineral de hierro, 13 mineral de diamante, 14 nieve, 15 cactus, 16 abedul; **20 a 26 son el agua que fluye** (niveles 1 a 7); 0 es aire). Los 7 ids del agua que fluye se generan con un bucle, y `ITEM_IDS` (inventario y catálogo creativo) no los incluye. Usar `isWater(b)`, no `b === WATER`.
- **`ITEMS`: lo que NO es un bloque** (no se pone en el mundo). Ids desde el **100**: manzana (100), palo (101), pico, hacha y pala de madera (102, 104, 106) y de piedra (103, 105, 107), **lingote de hierro (108), diamante (109)**, y pico, hacha y pala **de hierro (110, 112, 114) y de diamante (111, 113, 115)**. Cada herramienta tiene `nivel` (madera 0, piedra 1, hierro 2, diamante 3); un bloque con `nivel` (los minerales) solo suelta algo con una herramienta de ese nivel o mejor.
- `ID` da nombres a los ids más usados (`ID.MESA`, `ID.PALO`, `ID.PICO_PIEDRA`…): usarlos en vez de números sueltos. `itemInfo(id)` devuelve los datos de un id sea bloque u objeto (nombre, etc.). Un bloque también puede estar en el inventario con su mismo id.

```js
3: { name: 'Piedra', tiles: [3, 3, 3], hardness: 1.1, drop: 9, herramienta: 'pico', necesita: true }
//     nombre         [arriba, abajo, lados]  segundos a mano  qué suelta   la rompe mejor el pico    sin pico no suelta nada
```

Campos de un **bloque**:
- `tiles`: índices en el atlas de texturas. `hardness`: segundos para romperlo con la mano.
- `drop`: id que suelta (por defecto, el mismo). `dropChance`: probabilidad (por defecto 1).
- `extra: { id, chance }`: además, suelta otro objeto con esa probabilidad (las hojas dan manzanas, 3%).
- `herramienta`: `'pico'`, `'hacha'` o `'pala'`, la que lo rompe más rápido. `necesita: true`: solo suelta algo si se rompe con esa herramienta (piedra, adoquín y ladrillo con pico).

Campos de un **objeto**:
- Su dibujo es un sprite de 16×16 con **el mismo id** en `itemSprites` (`textures.js`, `paintSprite` o `spriteDePixeles`), no una cara del atlas.
- `food: n`: se come con click derecho y devuelve `n` de hambre (la manzana, 4).
- `tool: 'pico'|'hacha'|'pala'`, `velocidad` (multiplicador al romper bloques de ese tipo), `dur` (usos hasta romperse) y `agarre: [x, y]` (el píxel por donde la mano la agarra).
- `ITEM_IDS` (todos los bloques menos el agua, y todos los objetos) es lo que puede estar en el inventario y en el catálogo creativo.
- `isSolidB` (se puede chocar/apuntar: todo menos aire y agua) e `isOpaque` (tapa caras vecinas: todo menos aire, hojas y agua) son las dos reglas físicas y visuales.

**Para agregar un bloque:** `BLOCKS` en `config.js` (y un nombre en `ID` si lo van a usar otros), una o más texturas en `textures.js` con `paint(...)` y subir `NTILES`. (`OPAQUE` en `world.js` ya se arma solo con las claves de `BLOCKS`.)
**Para agregar un objeto:** una entrada en `ITEMS`, un nombre en `ID`, un sprite en `textures.js`, y si se fabrica, una receta en `objetos.js`. Nada más: la mano, el suelo, el ícono y el catálogo creativo ya lo dibujan solos.

### Objetos y recetas (`objetos.js`)

Todo puro (sin pantalla): se prueba solo.

- `maxPila(id)`: cuántos caben por casilla. 64, salvo las herramientas (1: tienen su propio desgaste).
- `RECETAS`: lista de `{ forma, da }`. `forma` son filas de ids con `0` = vacío; `da` es `[id, cantidad]`. Cada material (tablones, adoquín) genera pico, hacha y pala con un bucle.
- `buscarReceta(grilla, ancho)`: recibe los ids en orden de filas (`ancho` = 2 en el inventario, 3 en la mesa), **recorta la caja ocupada** (así la receta se reconoce en cualquier posición) y la compara con cada forma **y con su espejo**. Devuelve `{ id, count }` o `null`.
- `velocidadDeMinado(idEnMano, bloque)`: multiplicador de velocidad (1 si no es la herramienta correcta). `puedeRecoger(idEnMano, bloque)`: ¿suelta algo? (falso para un bloque con `necesita` sin la herramienta). `esHerramienta(id)`.

### Inventario, crafteo y desgaste (`inventory.js`)

- `inventory`: 36 casillas, cada una `null` o `{ id, count, dano }`. Espacios 0–8 = barra rápida. `dano` son los usos gastados de una herramienta (ausente = 0). Las pilas se arman con `nuevaPila(id, count, dano)` para que **el desgaste viaje con la herramienta** al moverla, partirla, tirarla (`spawnDrop(..., dano)`), recogerla y guardar.
- **Casillas de la pantalla:** los "índices" son 0–35 (el inventario), `100 + k` (la casilla `k` de la grilla de crafteo) y `200` (el resultado). `stackAt(i)` y `setAt(i, valor)` leen y escriben cualquiera de los tres, así `slotClick` es el mismo para todo.
- **Grilla de crafteo:** `craft` (9 casillas) y `craftLado` (2 al abrir con la tecla E, 3 al abrir la mesa). Hay dos grillas dibujadas (`#craftGrid2`, `#craftGrid3`) y se muestra una. El resultado se recalcula en cada `refreshInventoryUI` con `buscarReceta`. Click en el resultado: lo saca al cursor y gasta una unidad de cada ingrediente (`consumirIngredientes`); Shift+click repite mientras entre en la mochila. **Al cerrar** (`closeInventory`), lo que quedó en la grilla vuelve a la mochila.
- **Mesa de crafteo:** es el bloque `ID.MESA` (11). `placeBlock` en `game.js` la detecta antes de poner nada: click derecho sobre ella llama a `openInventory(3)`.
- **Desgaste:** `game.js` llama a `gastarHerramienta()` al romper cada bloque; suma un uso y, al llegar a `dur`, quita la herramienta. `renderSlot` dibuja la barrita (verde → roja) sobre el ícono.
- **Modo creativo:** el catálogo (`catalogSlots`) tiene pestañas (Todo/Bloques/Objetos) y un buscador (`filtrarCatalogo`, que ignora acentos). El 2×2 se oculta en creativo, pero la mesa siempre se ve.
- Estado del módulo: `selected` (espacio activo), `cursor` (pila arrastrada), `invOpen`, `creative`, `resultado`.
- La UI se redibuja con `refreshInventoryUI()` después de cada cambio.
- `drops`: objetos sueltos en el mundo (máximo 120, desaparecen a los 300 s).

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
- `biomeAt(x, z)`: dos ruidos de muy baja frecuencia (temperatura y humedad) dan **llanura, bosque, desierto o nevado**. No cambia las alturas, solo qué bloque va arriba (`generateChunk`) y qué árboles hay (`K_ARBOL` es la frecuencia relativa de cada bioma, multiplicada por `CONFIG.treeChance`).
- **Cuevas:** `esCueva(x, y, z)` es verdadero donde dos ruidos 3D (`noise3`) están a menos de `CUEVA_ANCHO` de 0,5 a la vez (un tubo). Solo se vacían celdas de `y = 3` hasta `h - 4`: el techo de 4 bloques protege el fondo de los lagos. Los **sumideros** (`esSumidero`: ruido 2D alto) bajan hasta 12 bloques hasta el primer túnel, y los árboles no crecen en esas columnas.
- **Minerales:** después de las cuevas, `veta()` camina al azar unos pasos desde un punto elegido con un generador (`azar`) sembrado con `hash2(cx, cz, seed + 5000)`, así que **cada chunk siempre da las mismas vetas**. Solo reemplaza piedra (id 3) y se corta en el borde del chunk (una veta no cruza al vecino).
- **Árboles por bioma:** roble (4–5 de alto), roble grande (6–7, copa de radio 3, solo en el bosque), abedul (tronco `ID.ABEDUL`), pino (nevado y sobre la altura 47: cono de hojas) y cactus (desierto). La función `capa` pone una capa cuadrada de hojas con o sin esquinas.
- **Cabañas:** `cabanaEn(gx, gz)` decide, para una celda de 48×48, si hay una y dónde (con `hash2`, sin guardar nada). Cada chunk revisa las celdas que lo tocan y escribe la parte de la cabaña que cae adentro, igual que los árboles, así que las cabañas cruzan bordes de chunk sin costuras.
- **Si cambiás el generador:** las pruebas `cuevas`, `minerales`, `biomas` y `estructuras` miran porcentajes y reglas (no bloques exactos); la de "terreno estable" mira las alturas (que no cambian con los biomas ni las cuevas).

### Objetos planos y la mano (`effects.js`)

- **Cómo se dibuja un objeto plano:** `makeItemGeometry(id, enMano)` convierte el sprite en una malla con espesor (un voxel de 2 píxeles de grosor por cada píxel opaco, con frente, dorso y los costados que dan al vacío, más oscuros). `itemMaterial(id)` da su material (una textura por objeto, sin suavizado). Se usa en tres lugares: la mano (`setHandBlock`), los objetos del suelo (`spawnDrop` en `inventory.js`) y el ícono (`makeBlockIcon` en `textures.js` dibuja el sprite plano en vez de un cubo isométrico). **Todo id con `sprite` tiene que pasar por estas funciones, no por `makeBlockGeometry`** (que busca `tiles` y falla).
- **El brazo** (`armMesh`) mide 0.8 de largo y está corrido 0.25 hacia atrás, así que su punta (la mano) queda en `HAND_TIP_Z = -0.15` del espacio de `handGroup`. El bloque u objeto sostenido se coloca ahí; antes estaba en z = −0.05 y se veía **a la mitad del brazo**. Las **herramientas** se agarran por el mango: `ITEMS[id].agarre` es el píxel del sprite donde va la mano, y `makeItemGeometry(id, true)` mueve el origen de la malla a ese punto (solo para la mano: en el suelo giran sobre su centro). Así el extremo del mango queda en la mano y la cabeza apunta hacia arriba.
- **El grupo de la mano se gira** (`handGroup.rotation` en `updateHand`, para que el brazo se vea en diagonal). Un objeto plano tiene que deshacer ese giro para mirar al jugador: se usa `rotation.order = 'ZYX'` con los ángulos opuestos, que es la inversa exacta del giro XYZ del grupo, más un pequeño giro para que no quede de frente. Si se cambia `handGroup.rotation`, hay que revisar también esto.
- `hand.mesh` es la malla que se sostiene (lo usan las pruebas).
- **Para ver cómo queda:** `npm run captura` (ver "Capturas" más abajo).

### Salud (`salud.js`)

- Los datos están en el objeto `player` (`player.js`): `vida` y `hambre` (0 a 20), `saturacion`, `agotamiento`, `muerto`, y para las caídas `fallMax` (lo más alto que estuvo desde que dejó el suelo) y `lastY`. También `spawn` (el punto de aparición del mundo) y `ajustarSpawn`.
- `game.js` llama a `gastar(n)` cuando hay actividad (correr, saltar, nadar, romper), a `alAterrizar(distancia)` al tocar el suelo, y a `actualizarSalud(dt)` en cada cuadro (con `dt = 0` si el juego está en pausa, así la comida y la vida no avanzan).
- **Caída:** en `physicsStep`, `fallMax` sube mientras está en el aire y se reinicia al volar, estar en el agua o **teletransportarse** (un salto de más de 2 bloques en un solo paso). Al aterrizar, `alAterrizar(fallMax − y)` resta `ceil(distancia − 3)`.
- **Muerte:** `danar` llega a 0 → `morir`: marca `player.muerto`, muestra `#muerte` y suelta el mouse. Con `player.muerto` el juego no hace física ni deja romper o poner. `reaparecer` restaura la salud, lo mueve a `player.spawn` y marca `ajustarSpawn` para que `physicsStep` lo suba si quedó dentro de un bloque.
- **Punto de aparición:** `buscarSpawn()` en `game.js` (tierra firme cerca de (8, 8)); se guarda con la partida.
- **Barra:** 10 corazones y 10 muslos como `<img>` con iconos dibujados por código (3 estados cada uno), que se vuelven a pintar solo cuando cambia el valor.
- Con `creative` activo no se aplica nada y la barra se oculta.

### Mobs (`mobs.js`) y la física compartida (`fisica.js`)

- **`fisica.js`:** `colisiona(x, y, z, w, h)` dice si una caja (medio ancho `w`, alto `h`, pies en `y`) toca un bloque sólido; `moverEje(cuerpo, eje, d, w, h)` mueve un cuerpo (`{ pos, vel, onGround }`) en un eje, lo pega al bloque si choca y frena su velocidad en ese eje (al pisar marca `onGround`). `game.js` la usa para el jugador (`W = 0.3`, `PH = 1.8`) y `mobs.js` para los mobs.
- **Un mob** es un objeto `{ tipo, def, grupo, patas, brazos, mat, pos, vel, onGround, yaw, vida, … }`. `TIPOS` tiene los datos de cada tipo (vida, caja, velocidad, botín, `pasivo` u `hostil`, y la función que arma su modelo). Para sumar un mob: una entrada en `TIPOS`, su `modelo…()` y, si aparece solo, tocar `intentarAparecer`.
- **Modelo:** cajas con color por vértice (`pixelBox` de `effects.js`, como el jugador) **unidas en una sola geometría** (`unir`): cuerpo + cabeza en una malla y cada miembro en otra con su pivote, **5 mallas por mob**. La geometría se arma **una vez por tipo** y se comparte; el **material se clona por mob** (así el destello rojo, `emissive`, no le pega a los demás; no cuesta programas nuevos). Todos miran hacia −Z, como el jugador.
- **IA** (`actualizarMob`, cada cuadro): `wx, wz` es hacia dónde quiere ir y `rapidez` a cuánto. Un mob que huye (`huir > 0`) se aleja de donde vino el golpe; un hostil a menos de 24 bloques va hacia el jugador y, a menos de 1,1 con la altura parecida, le pega con un enfriamiento de 1 s; si no, pasea (un rato quieto, un rato caminando a un rumbo al azar). Si choca contra un bloque salta (un escalón de 1 sí, de 2 no); si lleva 0,8 s chocando, elige otro rumbo.
- **Física del mob:** pasos de 25 ms (`pasos = ceil(dt / 0.025)`) con gravedad o flotación en el agua. **Sin pasos cortos, un mob que cae rápido atraviesa un piso de 1 bloque.** Si el chunk de abajo no está cargado, se queda quieto.
- **Aparición** (`actualizarMobs` → `intentarAparecer`): un intento cada 0,3 s (con menos de 3 mobs) o 1,5 s; elige un punto en un anillo alrededor del jugador, baja desde arriba hasta el primer suelo con 2 de aire y, si es agua, no aparece. Animales solo sobre césped (`id 1`); zombis de noche (`daylight < 0.4`) sobre cualquier suelo. Tope: `CONFIG.maxMobs`.
- **Sol:** un zombi con `daylight > 0.55` y sin nada sólido encima hasta 24 bloques pierde 2 de vida por segundo (rojo tenue); sin botín.
- **Combate:** `apuntarMob(origen, dirección, alcance)` prueba el rayo contra la caja de cada mob (método de las "losas") y devuelve el más cercano con su distancia `t`. En `game.js`, `raycast` ahora también devuelve `t` para los bloques: si el bloque está más cerca que el mob, el mob no se puede golpear; y si se apunta a un mob, `target` (el bloque) se descarta para no romper lo de atrás. `atacarMob` golpea cada 0,5 s con el click izquierdo mantenido; `golpear(mob, danio, ox, oz)` resta vida, empuja desde `(ox, oz)`, pone rojo al mob y hace huir a los pasivos; `matar` lo tira de costado 0,4 s, lo quita y suelta el botín con `spawnDrop` (no en creativo).
- **No se guardan**: la partida no sabe de los mobs.
- **Para probar:** `mc.spawnMob('cerdo', x, y, z)`, `mc.mobs`, `mc.golpearMob(mob, danio, ox, oz)`, `mc.quitarMob(mob)` y `mc.TIPOS`. `CONFIG.mobs = false` apaga la aparición automática.

### Agua que fluye (`agua.js`)

- **Ids:** 10 = fuente (nivel 0); 20 a 26 = niveles 1 a 7. `nivelAgua(b)` da el nivel y `alturaAgua(b)` la altura que ocupa.
- **Modelo "de tirar" (pull):** `nivelDeseado(x, y, z)` calcula qué nivel le toca a una celda mirando a sus vecinos: agua arriba → 1; fuente al costado → 1; agua que fluye de nivel L al costado → L + 1 (solo hasta 7); un vecino con aire o agua que fluye debajo **no se abre de costado** (cae). Si el resultado difiere del contenido actual, `mirar` pone el bloque (o aire si no le toca nada). Los cambios activan a los vecinos.
- **Secado:** sin fuente que la alimente, cada celda sube de nivel de a uno por paso hasta pasar el 7 y desaparece (todas a la vez, así que una charca se seca en ~7 pasos y una cascada en tantos pasos como alto tenga).
- **Qué se revisa:** `activeWater` (un `Set` de claves `waterKey(x, y, z)`) que llena `setBlock`. `pasoAgua()` toma hasta 400, las mira y rehace las mallas. `tickAgua(dt)` lo llama el bucle de `game.js` cada 0,2 s (no en pausa). Las celdas en chunks sin cargar se saltean.
- **Para probar sin esperar:** `mc.pasoAgua()` desde la consola o las pruebas.

## Cómo se dibuja el mundo

Es la parte más técnica; está en `world.js` (`buildChunkMesh`):

1. **Copia con borde:** antes de armar la malla, el chunk y 1 bloque de cada vecino se copian a un arreglo plano `pad` de 18×18×(H+2). Así consultar vecinos es una suma de índices, sin buscar en el `Map`.
2. **Eliminación de caras ocultas:** solo se genera una cara si el vecino no es opaco. Las caras entre dos bloques sólidos no existen.
3. **Ambient occlusion por vértice:** cada vértice se oscurece según los 3 bloques vecinos de su esquina (niveles en `AO_LEVELS`). La diagonal del cuadrado se elige para que el degradado no quede torcido.
4. **Hojas:** con `fancyLeaves` apagado, solo se dibujan las caras contra algo que no sea hoja. Un atributo por vértice (`sway`) las mece con un shader inyectado en `onBeforeCompile`.
5. **Agua:** va en una malla aparte, translúcida. La altura de cada celda baja con su nivel (`alturaAgua`: 0,88 la fuente, menos cuanto más lejos) salvo que haya agua encima (altura 1). Las caras de costado entre dos celdas de agua se dibujan solo en la parte que sobresale de la vecina más baja.
5b. **Luz del cielo (cuevas oscuras):** `fillPad` calcula para cada columna del `pad` el nivel del bloque opaco más alto (`skyY`). Cada cara se multiplica por `LUZ[d]`, donde `d` es cuántos bloques hay entre la celda que mira la cara y ese techo (`d < 1` = a cielo abierto = 1). `LUZ` baja `CONFIG.luzPorBloque` por bloque hasta `CONFIG.luzMinima`. Las hojas y el agua no cuentan como techo. Solo mira la columna: no entra luz de costado por la boca de una cueva.
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

`guardarPartida()` arma: `version` (1), `nombre`, `semilla`, `hora`, `creativo`, `seleccionado`, `itemsV` (2), `inventario` (36 casillas `{id, count, dano}` o `null`; `dano` solo si la herramienta tiene desgaste), `vida`, `hambre`, `saturacion`, `spawn`, `jugador` (`x, y, z, yaw, pitch, vuela`) y `chunks` (lista de `{cx, cz, maxY, data}`, con solo los modificados).

- **En disco:** JSON comprimido con gzip; cada `data` (16384 bytes por chunk) va en base64. La conversión la hace `guardado-main.js`, así la página maneja `Uint8Array` directamente.
- **Cargar:** en `game.js`, `cargarPartida()` se llama **antes de generar chunks**, porque cambia la semilla, rellena `savedChunks` y deja al jugador donde estaba. Si no hay partida, la semilla sale de `&semilla=` y el jugador aparece en `buscarSpawn()`.
- **Compatibilidad hacia atrás:** los campos de salud, `spawn` y `nombre` son opcionales. Una partida sin ellos arranca con vida y hambre llenas. Si se cerró el juego en la pantalla de muerte (`vida` 0), se reaparece en el inicio. **Agregar campos opcionales no obliga a subir `VERSION`.** Lo mismo con `itemsV`: una partida sin esa marca viene de antes de los objetos nuevos, cuando la manzana era el id 11 (hoy la mesa de crafteo); al cargarla, `cargarPartida` cambia ese id por `ID.MANZANA` (100) en el inventario.
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

## Capturas: cómo ver lo que dibuja el juego

`npm run captura` abre el juego en Electron sin ventana, arma cada escena y guarda un PNG en `capturas/` (carpeta ignorada por git). `npm run captura -- mano-bloque,suelo` saca solo algunas. Escenas: `mano-bloque`, `mano-piedra`, `mano-manzana`, `mano-vacia`, `suelo`, `inventario`, `barra`, `pantalla`. Para agregar una, sumarla a `ESCENAS` en `test/captura.js`.

**Para qué:** `npm test` comprueba que las cosas existen y funcionan, pero no puede decir si **se ven bien**. Después de cambiar algo visual (modelos, texturas, la mano, la interfaz), sacá la captura y mirala (con la herramienta de leer archivos, que muestra la imagen) antes de decir que quedó bien. El bloque a mitad del brazo y la manzana cúbica pasaron inadvertidos hasta que se miró una captura.

## Cómo pedirle cambios a la IA con esta estructura

El README original dice que la estructura está "pensada para pedirle cambios archivo por archivo". Mapa rápido de **a qué archivo ir según lo que quieras**:

| Quiero cambiar… | Archivo |
|---|---|
| Un número (velocidad, distancia, altura de nubes) | `config.js` |
| Un bloque nuevo o sus propiedades | `config.js` + `textures.js` |
| Un objeto nuevo que no es bloque (como la manzana o una herramienta) | `config.js` (`ITEMS` e `ID`) + un sprite en `textures.js` |
| Una receta de crafteo nueva | `objetos.js` (`RECETAS`) |
| El crafteo, las herramientas, el desgaste o el catálogo creativo | `inventory.js` (pantalla y lógica), `objetos.js` (reglas) y `index.html` (estilos) |
| Cómo se ve una textura | `textures.js` |
| Un mob nuevo, su IA, su botín o cuántos aparecen | `mobs.js` (`TIPOS`, `actualizarMob`, `intentarAparecer`) y `config.js` (`maxMobs`) |
| Cómo chocan los cuerpos con los bloques (jugador y mobs) | `fisica.js` |
| Pegarle a un mob, el arma y el daño | `game.js` (`atacarMob`), `mobs.js` (`golpear`) y `config.js` (`danio` en `ITEMS`) |
| Cómo es el terreno, árboles, biomas, cuevas, minerales, cabañas | `world.js` (`heightAt`, `biomeAt`, `esCueva`, `cabanaEn`, `generateChunk`) |
| Qué tan oscuras son las cuevas | `config.js` (`luzMinima`, `luzPorBloque`) y `world.js` (`fillPad`, `LUZ`) |
| Cómo fluye el agua | `agua.js` (reglas) y `world.js` (qué celdas se revisan, y la forma en la malla) |
| Un mineral o una herramienta con "nivel" | `config.js` (`nivel` en `BLOCKS` e `ITEMS`) y `objetos.js` (`puedeRecoger`) |
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

## Empaquetado (instalador)

- **Qué entra al paquete** lo decide `build.files` en `package.json`: los archivos de arriba más `src/**/*` y `node_modules/three/build/three.module.js`. electron-builder agrega solo las dependencias de producción completas (three entero, con ejemplos y fuentes, son 400 archivos más y unos 4 MB); por eso hay patrones `!node_modules/three/...` que dejan solo lo que carga el import map de `index.html`.
- **Si agregás un archivo en la raíz** (por ejemplo otro `.js` del proceso principal), **hay que sumarlo a `build.files`**: los archivos de `src/` entran solos, los de la raíz no. Si falta algo, el juego instalado falla y `npm start` no: por eso existe `npm run probar-empaquetado`.
- **Si cambiás la versión de three**, cambiá también el nombre del archivo en `build.files` y en el import map.
- **Rutas:** el código no usa rutas relativas al proyecto salvo `__dirname` en `main.js` (dentro del paquete es `app.asar`, y funciona igual) y los datos van a `app.getPath('userData')`. `productName` ("MiniCraft") hace que la carpeta de datos se llame `MiniCraft`; Windows no distingue mayúsculas, así que es la misma `minicraft` de siempre.
- **El instalador silencioso** (`/S`) igual abre el juego al terminar, y el desinstalador silencioso termina después de devolver el control (hay que esperar unos segundos).

## Puntos frágiles a tener en cuenta

Leídos del código; no son bugs confirmados, sino lugares donde un cambio puede romper algo:

- **Dependencias circulares:** hoy no hay y las reglas de arriba las evitan. Si un archivo "de abajo" necesita algo de uno "de arriba", la solución es pasarlo por parámetro o mover código, no importar en círculo.
- **Reasignar lo importado** (`daylight = …` desde otro archivo) da error en el navegador. Usar un objeto o una función, como `shadow.dirty`.
- **`OPAQUE` e `IS_WATER` en `world.js`** se arman solos con las claves de `BLOCKS` (todo tapa, menos las hojas y el agua). Un bloque transparente nuevo tiene que ajustarlos.
- **`NTILES = 20` y el atlas** son números sueltos que deben coincidir con las texturas dibujadas (0–19). Los objetos planos no usan el atlas.
- **El agua tiene 8 ids** (10 y 20–26). Todo código que pregunte "¿es agua?" tiene que usar `isWater(b)`; un `=== WATER` ignora el agua que fluye (el jugador no nadaría en ella, se podría poner un bloque dentro, etc.).
- **Los mobs usan `isSolidB` y `getBlock`** como el jugador: si cambia qué es sólido, cambia por dónde caminan. **`getBlock` devuelve aire en chunks sin cargar**, por eso un mob sobre un chunk sin cargar se detiene (si no, caería para siempre).
- **El material de cada mob es una copia** (`baseMat.clone()`): hay que llamar a `quitar(mob)` (libera el material); sacarlo solo de la escena deja basura.
- **`setBlock(x, y, z, b, diferir)`** avisa al agua (`activeWater`) cuando hay agua en la celda o pegada a ella. Con `diferir = true` no rehace la malla en el momento: la deja en `mallasPendientes` hasta `rehacerMallas()` (lo usa `agua.js`, para rehacer un chunk una sola vez por paso).
- **Los ids de objetos (100 en adelante) nunca deben terminar en `chunks`** (el mundo guarda un byte por bloque y `BLOCKS[100]` no existe). Por eso `placeBlock` descarta todo lo que está en `ITEMS` antes de poner nada.
- **Cambiar un id guardado rompe las partidas.** Las manzanas eran el 11 y pasaron al 100 cuando el 11 se volvió la mesa de crafteo; se resolvió con la marca `itemsV` en el guardado (ver abajo). Si hay que mover otro id, hace falta una migración igual.
- **Las herramientas no se apilan** (`maxPila` = 1). Cualquier código nuevo que cree o mueva pilas tiene que pasar por `nuevaPila`/`invAdd`/`moveInto` para no perder el campo `dano`.
- **Los teletransportes** (un cambio de posición de más de 2 bloques en un paso) reinician el conteo de caída. Si agregás una forma de moverse mucho en un paso, tené en cuenta que no cuenta como caída.
- **Todo corre en un solo hilo.** Cualquier trabajo pesado nuevo (más generación, mobs, guardado) puede notarse en los FPS.
- **Las pruebas (`npm test`) no ven el aspecto ni el mouse real.** Detalle y límites en [06-checklist-pruebas.md](06-checklist-pruebas.md#pruebas-automáticas-npm-test).
