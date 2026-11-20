# MiniCraft: instrucciones para la IA

Clon de Minecraft en Electron + Three.js, hecho como experimento de aprendizaje de prompting. Hablale a Max en español (voseo).

## Reglas

- **Vos escribís todo el código.** Max no edita a mano. Si hay que cambiar un número, lo cambiás vos.
- **Esta sesión es independiente.** Se trabaja desde varios dispositivos y no recordás sesiones anteriores. Lo único compartido es el repositorio: leé la documentación antes de tocar nada.
- **Rendimiento:** el juego debe correr bien en cualquier PC. Antes de sumar algo que cueste por frame, pensá en los FPS.
- **No uses assets, nombres ni código de Mojang o Microsoft.** Todo es original y generado por código.

## Al empezar la sesión

1. Corré `git pull` (preguntale a Max si hay dudas sobre ramas). Sin esto se trabaja sobre una versión vieja.
2. Leé [docs/08-guia-para-sesiones.md](docs/08-guia-para-sesiones.md) (cómo leer, escribir docs y pensar etapas; es corta) y después [docs/README.md](docs/README.md), [docs/02-estado-actual.md](docs/02-estado-actual.md) y [docs/03-arquitectura.md](docs/03-arquitectura.md).
3. Leé las últimas 2 o 3 entradas de [docs/bitacora/](docs/bitacora/), en especial el campo **Quedó pendiente**.
4. Preguntale a Max qué quiere hacer. Si es una función grande, hacé preguntas antes de escribir código.

## Al terminar la sesión

1. Actualizá la documentación que el cambio dejó desactualizada:
   - función nueva o quitada → `docs/02-estado-actual.md` y `docs/04-roadmap.md`
   - estructura del código, orden de scripts o datos → `docs/03-arquitectura.md`
2. Creá `docs/bitacora/AAAA-MM-DD-tema.md` con la plantilla de [docs/05-proceso-vibecoding.md](docs/05-proceso-vibecoding.md). Es un archivo nuevo por sesión: **no edites la bitácora de otras sesiones** (evita conflictos entre dispositivos). Llená el campo **Quedó pendiente**.
3. Hacé commit cuando Max lo pida. **Después de cada commit hacé `git push` sin preguntar** (Max lo autorizó el 2026-11-19): sin eso, la sesión siguiente en otro dispositivo no ve nada. Solo push normal a `main`: nunca `--force` ni borrar ramas sin que lo pida.

## Cómo correr

```
npm install    # solo la primera vez
npm start      # jugar
npm test       # las pruebas automáticas (≈30 s, sin mostrar ventana); `npm test -- hora` corre solo algunas
npm run captura   # saca PNG del juego en capturas/ (mano, suelo, inventario, crafteo, mesa, barra, sprites, mobs, biomas…) para MIRARLOS
npm run empaquetar          # arma el instalador de Windows (dist/MiniCraft-Setup-0.1.0.exe, ~84 MB; dist/ no se commitea)
npm run empaquetar:carpeta  # solo la carpeta dist/win-unpacked (mas rapido) y despues: npm run probar-empaquetado
```

F12 abre la consola. `window.mc` expone el estado del juego.

**Corré `npm test` antes de cada commit de código.** Si agregás o cambiás una función, sumá su prueba en `test/pruebas.js` (guía en [docs/06-checklist-pruebas.md](docs/06-checklist-pruebas.md#pruebas-automáticas-npm-test)). Si una prueba falla, no commitees hasta entender por qué: puede ser un bug del juego o un error de la prueba, y hay que decir cuál.

## Convenciones del código

- **Módulos ES, sin bundler.** Cada archivo de `src/` importa lo que usa (`import`) y exporta lo que otros necesitan en un `export { … }` al final. `game.js` es la entrada (`index.html` solo carga ese). No hay globales: `THREE` se importa con `import * as THREE from 'three'`.
- **Sin dependencias circulares.** Un archivo importa solo de los "más abajo" en el grafo de [docs/03-arquitectura.md](docs/03-arquitectura.md#grafo-de-dependencias). Un módulo no puede reasignar lo que importa: usá un objeto (`shadow.dirty`) o una función.
- **`three` está fijado en 0.149.0** (se importa `three.module.js` con un import map en `index.html`). No lo actualices por tu cuenta: desde r155 cambia la iluminación y hay que revisarlo mirando el juego.
- Un archivo por responsabilidad (mapa en [docs/03-arquitectura.md](docs/03-arquitectura.md)). Un archivo nuevo se usa agregando el `import` donde se necesite; no hay que tocar `index.html`.
- Los valores ajustables van en `src/config.js`. Los bloques están definidos por datos en `BLOCKS`.
- Comentarios en español, breves. No agregues dependencias nuevas sin preguntarle a Max.
- Texturas y modelos se dibujan por código; no se agregan imágenes externas.

## Limitaciones conocidas que afectan a cualquier cambio

- **Hay varios mundos y se guardan solos** (cada 30 s, al cerrar y al volver al menú) en `%APPDATA%\minicraft\mundos\<id>\`: solo los chunks modificados, inventario, modo, hora, posición, vida y hambre. Al abrir el juego aparece el **menú** (`src/menu.js`); el mundo que se juega lo elige la dirección de la página (`?mundo=<id>&semilla=N&nombre=…`), y elegir, crear o volver al menú **recarga la página**. Detalle en [docs/03-arquitectura.md](docs/03-arquitectura.md#guardado-en-disco).
- **Salud** (`src/salud.js`): vida y hambre de 0 a 20 en `player`, daño por caída, muerte (se conserva el inventario) y la manzana como única comida. En creativo no aplica. Detalle en [docs/03-arquitectura.md](docs/03-arquitectura.md#salud-saludjs).
- **Volar y la tecla T son solo del modo creativo** (volar: doble toque de Espacio en `game.js`, no la F). `setCreative(false)` baja al jugador. Si agregás otra "trampa", ponele el mismo chequeo `creative`.
- **Un archivo de partida ilegible nunca se pisa:** `cargar` (`guardado-main.js`) lo aparta como `mundo.danado-<hora>.json.gz` y devuelve `{ danado: [...] }`; y si el arranque del mundo falla (`arrancar()` en `game.js`) se frena el guardado (`detenerGuardado`). Si tocás cómo se carga o se guarda, mantené esas dos garantías y sus pruebas (están al final de `test/run.js`).
- **Los ids de mundo** solo admiten `[a-z0-9-]`: `guardado-main.js` los valida porque llegan desde la página y no deben poder salirse de `mundos\`. Cualquier canal IPC nuevo que reciba un id tiene que pasar por `carpetaMundo()`.
- **No pruebes cambios en archivos del proceso principal** (`main.js`, `guardado-main.js`, `preload.js`) con sabotajes que rompan la sintaxis o lancen errores: Electron muestra un diálogo de error **en la pantalla de Max** y deja colgado el proceso. Usá cambios válidos que alteren el comportamiento, y guardá una copia del archivo antes (`cp`) para restaurar.
- **Si tocás lo que se guarda:** agregar un campo **opcional** al estado no obliga a subir `VERSION` (los que faltan toman un valor por defecto, como hicieron la salud y el punto de aparición); un cambio de formato incompatible sí: subí `VERSION` en `src/guardado.js` **y** en `guardado-main.js`. En ambos casos actualizá `test/pruebas.js` y `test/pruebas-reinicio.js`. Si cambiás el generador de terreno, los mundos viejos quedan con costuras (solo se guardan los chunks modificados).
- **Cuando probés el juego a mano con `npm start`, estás usando los mundos reales de Max.** Preguntale antes de construir, romper o borrar cosas ahí. `npm test` usa una carpeta temporal y no los toca.
- Los chunks modificados se mantienen en memoria en `savedChunks` (`world.js`).
- Para probar en el navegador integrado, el panel tiene que estar visible; si está oculto no corren los cuadros.
- La generación de chunks corre en el hilo principal.
- `npm test` cubre la lógica pero **no ve el aspecto** (colores, texturas, sombras), ni el mouse real, ni el rendimiento en una PC modesta.
- **Si cambiás algo visual** (modelos, texturas, la mano, la interfaz), corré `npm run captura` y **mirá los PNG de `capturas/`** (con la herramienta de leer archivos, que muestra imágenes) antes de decir que quedó bien. Un bloque a mitad del brazo y una manzana cúbica pasaron inadvertidos porque nadie miró. Si no pudiste mirarlo, decilo en vez de afirmar que se ve bien.
- **El instalador** (Fase 5, electron-builder, configuración en `build` de `package.json`) solo lleva lo que dice `build.files`: `src/**` entra solo, **un archivo nuevo en la raíz hay que sumarlo ahí**, y si no, el juego instalado falla y `npm start` no. Después de tocar el empaquetado o agregar archivos en la raíz, corré `npm run empaquetar:carpeta` y `npm run probar-empaquetado` (la ventana se ve unos segundos; usa datos temporales, no toca los mundos de Max). **No instales ni abras el .exe instalado de verdad sin avisar**: el instalador silencioso abre el juego con los mundos reales de Max. `electron-builder` es una dependencia de desarrollo aprobada por el pedido de la Fase 5.
- **Los mods** (carpeta `%APPDATA%\minicraft\mods`, API en `src/mods.js`, guía en [docs/07-mods.md](docs/07-mods.md)): registran bloques, objetos, recetas, mobs, generación y eventos. **Los ids de mods se guardan en cada mundo** (`estado.mods.tabla`) y los mods ausentes dejan marcadores "desconocido": nunca asumas que `BLOCKS[id]` o `ITEMS[id]` son los de siempre para ids de 30 en adelante (bloques) o de 200 en adelante (objetos). Si cambiás algo que ya existe de la API, subí `API_VERSION` en `src/mods.js` **y** en `mods-main.js`. Las pruebas de mods (`test/pruebas-mods.js`) solo corren en la corrida completa de `npm test` (no con un filtro sin "guardar"). **`mods-main.js` es un archivo del proceso principal**: valen las reglas de abajo (nada de sabotajes que rompan la sintaxis).
- **La física de choque es compartida** (`fisica.js`: `colisiona`, `moverEje`): el jugador (`game.js`) y los mobs (`mobs.js`) la usan. Un cuerpo es cualquier objeto con `pos`, `vel` y `onGround`; el ancho y el alto se pasan en cada llamada. `CONFIG.mobs` apaga los mobs y `mc.spawnMob(tipo, x, y, z)` pone uno a mano; las pruebas apagan los mobs en `arena()` para no depender del azar.
- **El agua tiene 8 ids** (10 = fuente, 20–26 = fluyendo): preguntá siempre `isWater(b)`, nunca `b === WATER`. Cambiar un bloque junto al agua la hace fluir (`agua.js`); `mc.pasoAgua()` avanza un paso en las pruebas. El generador de terreno (biomas, cuevas, minerales, árboles, cabañas) está en `world.js`: un cambio ahí deja costuras en los mundos viejos y obliga a revisar las pruebas `cuevas`, `minerales`, `biomas` y `estructuras`.
- **Bloques y objetos son dos registros:** `BLOCKS` (ids 1–99, lo que existe en el mundo) e `ITEMS` (ids desde 100, lo que NO es un bloque: manzana, palo, herramientas). Para un objeto nuevo: entrada en `ITEMS` + nombre en `ID` (`config.js`) + sprite en `itemSprites` (`textures.js`) + receta en `objetos.js` si se fabrica. Se dibujan con `makeItemGeometry`/`itemMaterial` (`effects.js`), nunca con `makeBlockGeometry`. **Usá `ID.MESA`, `ID.PALO`… en vez de números sueltos.** Un id de objeto nunca debe terminar en `chunks`. Detalle en [docs/03-arquitectura.md](docs/03-arquitectura.md#objetos-planos-y-la-mano-effectsjs).
