# 04 · Roadmap

> Última revisión: 2026-11-19 · Corresponde al commit `e69a868`.
> Las **funciones** de esta lista las pidió Max. El **orden, las dependencias y las dificultades** son una propuesta de la IA, para discutir y cambiar.

Meta general: llegar lo más cerca posible de Minecraft, sin techo definido (ver [01-vision.md](01-vision.md)).

## Funciones deseadas

Pedidas explícitamente por Max:

1. Guardar y cargar el mundo
2. Crafteo y herramientas
3. Mobs y vida
4. Mundo más rico (biomas, cuevas, minerales, más bloques)
5. Multijugador
6. Un mejor inventario
7. Mods
8. Instalador de Windows
9. "Todo lo que se pueda" (la lista queda abierta)

## Orden propuesto

El criterio es que **cada fase deje lista la base de la siguiente**. Hacerlo al revés suele obligar a rehacer cosas.

### Fase 0 · Cimientos

Preparar el terreno para que el resto no se rompa. No agrega nada visible.

| Tarea | Por qué primero |
|---|---|
| ✅ **Hecho (2026-11-19).** Los cambios al mundo ya no se pierden al alejarte: los chunks modificados se guardan en memoria (`savedChunks`). | Era la base del guardado y del multijugador. Queda pendiente el guardado en disco (Fase 1) y limitar el uso de memoria. |
| ✅ **Hecho (2026-11-19): migración a módulos ES.** Ver [arquitectura](03-arquitectura.md#decisión-clave-módulos-es-sin-bundler). | Los mods, el multijugador y mantener el código grande lo piden. **Queda pendiente actualizar Three.js** (hoy 0.149): cambia la iluminación desde r155 y hay que revisar el aspecto del juego; mejor como tarea aparte. |
| **Agregar una forma mínima de probar** (por ejemplo un script que genere chunks y verifique datos). | Hoy la única verificación es jugar. |

> Siguiente de la Fase 0: una forma mínima de probar sin jugar a mano. La migración a módulos se hizo temprano, con el código chico (~1.950 líneas), que es cuando sale más barata.

### Fase 1 · Persistencia y base de supervivencia

| Función | Depende de | Qué toca |
|---|---|---|
| **Guardar/cargar mundo** | Fase 0 | `world.js` (serializar chunks modificados y semilla), `inventory.js` (guardar inventario), `main.js` (acceso a archivos desde Electron). |
| **Menú principal** (nuevo mundo / cargar) | Guardado | `index.html` y un archivo nuevo de UI. |
| **Vida, hambre, daño de caída** | — | `game.js` y UI en `index.html`. Prepara a los mobs. |

### Fase 2 · Crafteo y herramientas

| Función | Depende de | Qué toca |
|---|---|---|
| **Más bloques y objetos que no son bloques** (palos, herramientas) | Un registro de ítems distinto del de bloques | `config.js`, `textures.js`, `inventory.js`. Hoy un ítem es solo un id de bloque. |
| **Mesa de crafteo y recetas** | Ítems | `inventory.js` y UI. |
| **Herramientas y durabilidad** | Ítems | `game.js` (`updateMining` usa solo `hardness`), `config.js`. |
| **Mejor inventario** (ver abajo) | Ítems | `inventory.js`. |

**"Mejor inventario" = que se parezca más al de Minecraft original** (definición de Max). Concretamente, tomando como referencia el original (a validar con Max):

- Cuadrícula de crafteo 2×2 dentro del inventario, con su casilla de resultado.
- Cuatro ranuras de armadura y un muñeco del jugador al lado.
- Ranura de la mano secundaria.
- Mesa de crafteo con cuadrícula 3×3 (pantalla aparte).
- Íconos y nombres para ítems que no son bloques (palos, herramientas).
- En creativo, un catálogo con pestañas por categoría y buscador.
- Estilo visual y comportamiento de los clicks fieles al original (hoy ya hay click, click derecho, Shift+click y las teclas 1–9).

Hoy el inventario tiene 36 espacios, pilas de 64 y modo creativo; falta todo lo de la lista, salvo lo ya existente.

### Fase 3 · Mundo más rico

| Función | Depende de | Qué toca |
|---|---|---|
| **Cuevas y minerales** | Terreno 3D | `world.js`: hoy el terreno es un mapa de alturas (una superficie por columna). Hay que sumar ruido 3D. |
| **Biomas** (desierto, nieve, bosque…) | Más bloques | `world.js`, `sky.js` (color de niebla), `textures.js`. |
| **Agua que fluye** | — | `world.js` y una regla de actualización de bloques. |
| **Estructuras y árboles variados** | Biomas | `world.js`. |

### Fase 4 · Mobs

| Función | Depende de | Qué toca |
|---|---|---|
| **Entidades** (sistema base: posición, física, dibujo) | Fase 1 (vida) | Archivo nuevo. Reutilizar la física de `game.js` (`collides`, `moveAxis`) y el modelo de `character.js`. |
| **Animales pasivos, luego enemigos** | Entidades | Archivo nuevo. IA simple primero. |
| **Combate** | Vida, entidades | `game.js`. |

### Fase 5 · Distribución

| Función | Depende de | Qué toca |
|---|---|---|
| **Instalador de Windows (.exe)** | Idealmente guardado | `package.json` (agregar `electron-builder` o similar), `main.js` (rutas). Se puede hacer antes si se quiere compartir una versión temprana. |

> El instalador **no depende de nada técnico** y se puede adelantar cuando Max quiera pasarle el juego a alguien.

### Fase 6 · Multijugador y mods

Las dos más grandes; quedan al final porque exigen que lo demás sea estable.

| Función | Depende de | Qué toca / notas |
|---|---|---|
| **Multijugador** | Persistencia, módulos, Fase 0 | Hoy el estado vive en variables globales y todo corre en un cliente. Hay que separar "estado del mundo" de "dibujo". Recomendación abajo. |
| **Mods** (hechos por otras personas) | Módulos ES, registro de bloques/ítems | `BLOCKS` ya está basado en datos, lo cual ayuda. Falta una API pública para registrar bloques, ítems y eventos, una carpeta `mods/`, un ejemplo y documentación para quien escriba un mod. Ver más abajo. |

#### Multijugador: recomendación

Max pidió "la opción mejor y más factible". Propuesta (a validar):

1. **Un jugador hace de anfitrión** (el juego de uno actúa como servidor) en vez de un servidor dedicado. Es lo más factible: no hace falta alquilar ni mantener un servidor, y el instalador es uno solo. El anfitrión corre la lógica del mundo y los demás se conectan.
2. **Primero en red local (LAN)**, porque no requiere configurar el router ni abrir puertos. Se puede probar con dos PC en la misma red, o dos ventanas en una.
3. **Internet después**, como segundo paso. Sin servidor propio, hay dos caminos: que el anfitrión abra un puerto en su router (técnico para el usuario), o usar un intermediario (túnel o conexión directa tipo WebRTC). La decisión se toma recién cuando la LAN ande.
4. **Tecnología probable:** WebSocket, con el servidor corriendo dentro del proceso principal de Electron (`main.js`). Habría que sumar una dependencia (por ejemplo `ws`).

Por qué no un servidor dedicado: es más trabajo (alojamiento, costos, mantenimiento), y el proyecto hoy es de un solo desarrollador. Se puede sumar más adelante porque el modelo "anfitrión" se puede mover a un servidor sin rehacerlo, si se separa bien el estado del mundo.

Esta es la fase más grande y no se puede hacer antes de resolver la persistencia y separar el estado del dibujo.

#### Mods: qué implica que los hagan otras personas

- **API estable y documentada:** una vez que otros escriban mods, cambiar la API los rompe. Conviene definirla con cuidado y versionarla.
- **Seguridad:** un mod es código ajeno ejecutándose dentro del juego. En Electron eso puede tocar archivos de la PC si no se aísla. Hay que decidir el nivel de confianza (¿solo mods que el usuario instala a mano y confía?, ¿o aislados?).
- **Formato de mod:** una carpeta con un archivo de descripción (nombre, versión, autor) y código JavaScript.
- **Distribución:** ¿cómo se comparten los mods? (carpeta a mano, repositorio, lista curada). Se decide más adelante.
- **Orden recomendado:** primero que los bloques e ítems propios del juego se registren por la misma API que usaría un mod. Si el juego "come su propia comida", la API queda probada.

## Ideas adicionales (no confirmadas)

No las pidió Max; salen de lo que le falta al juego frente a Minecraft. Se agregan al roadmap solo si él las confirma.

- Sonido y música.
- Menú de opciones (controles configurables, sensibilidad, volumen).
- Bloques que no son cubos (escaleras, losas, antorchas, puertas).
- Iluminación por bloque (antorchas, cuevas oscuras).
- Clima (lluvia, tormentas).
- Soporte para otros sistemas operativos.

## Requisito transversal: rendimiento

El juego debe correr bien en cualquier PC (ver [01-vision.md](01-vision.md#requisito-de-rendimiento)). Cada función nueva se evalúa por su costo en FPS. Puntos donde el diseño actual puede dar problemas:

- La generación de chunks corre en el hilo principal. Cuevas con ruido 3D son bastante más caras que el terreno actual.
- Los mobs suman trabajo en cada frame.
- El multijugador suma trabajo de red.
- Las sombras ya son lo más caro; hay presets, pero hay que mantenerlos al sumar funciones.

Mitigaciones posibles cuando haga falta: generar chunks en un `Worker`, limitar la cantidad de mobs activos, y extender los presets de calidad.

## Decisiones tomadas

| Fecha | Decisión |
|---|---|
| 2026-11-19 | Todo el código lo escribe la IA, Max no edita a mano. |
| 2026-11-19 | Herramienta única: Claude Code. |
| 2026-11-19 | Distribución prevista: instalador de Windows. |
| 2026-11-19 | Los mods los harán otras personas. |
| 2026-11-19 | "Mejor inventario" = más parecido al de Minecraft original. |
| 2026-11-19 | El multijugador usa la opción más factible (propuesta: anfitrión + LAN primero). |

## Preguntas abiertas

- ¿Qué prioridad real tiene cada función? El orden de arriba es técnico, no necesariamente el que Max quiere.
- ¿Qué cuenta como "PC modesta" en números? Hace falta para medir el requisito de rendimiento.
- ¿Para el multijugador se acepta la recomendación de anfitrión + LAN primero?
- ¿Cuál es el nivel de confianza esperado para los mods (instalar a mano vs. aislados)?
- ¿Se prioriza parecerse a Minecraft o agregar ideas propias cuando la fiel no se pueda?
