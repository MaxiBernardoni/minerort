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
| ✅ **Hecho (2026-11-19): pruebas automáticas** con `npm test`. | Detalle en [06-checklist-pruebas.md](06-checklist-pruebas.md#pruebas-automáticas-npm-test). No ven el aspecto ni el mouse real. |

> La Fase 0 está completa salvo actualizar Three.js. La migración a módulos y las pruebas se hicieron temprano, con el código chico (~1.950 líneas), que es cuando salen más baratas.

### Fase 1 · Persistencia y base de supervivencia

| Función | Depende de | Qué toca |
|---|---|---|
| ✅ **Guardar/cargar mundo (hecho 2026-11-19)** | Fase 0 | Automático, una carpeta por mundo. Ver [Guardado](02-estado-actual.md#guardado) y [arquitectura](03-arquitectura.md#guardado-en-disco). Falta guardar los objetos soltados. |
| ✅ **Menú principal y varios mundos (hecho 2026-11-19)** | Guardado ✅ | Elegir, crear y borrar mundos; volver al menú desde la pausa. Ver [Mundos y menú](02-estado-actual.md#mundos-y-menú-principal). Faltan: renombrar y duplicar mundos, elegir el modo al crear, y un menú de opciones. |
| ✅ **Vida, hambre, daño de caída (hecho 2026-11-19)** | — | Con muerte, reaparición y una comida mínima (la manzana). Ver [Salud](02-estado-actual.md#salud-solo-en-supervivencia). Los números salen de Minecraft y falta ajustarlos jugando. Prepara a los mobs. |

> **La Fase 1 está completa.** Decisiones que tomó la IA donde el roadmap no decía nada, todas fáciles de cambiar: la comida es solo la manzana (sin ella el hambre sería solo un castigo); al morir se conserva el inventario; la inanición no mata; el menú recarga la página en vez de reiniciar el estado a mano.

### Fase 2 · Crafteo y herramientas ✅

| Función | Depende de | Qué se hizo (2026-11-20) |
|---|---|---|
| ✅ **Objetos que no son bloques** | Un registro de ítems distinto del de bloques | `ITEMS` (ids desde 100) separado de `BLOCKS` (ids 1–99), con `ID` para los nombres. Ocho objetos: manzana, palo, y pico, hacha y pala de madera y de piedra. Se dibujan como sprites planos con espesor (mano, suelo e inventario). |
| ✅ **Mesa de crafteo y recetas** | Ítems | Bloque nuevo (id 11) que se abre con click derecho, grilla de 3×3 y casilla de resultado. En el inventario hay una de 2×2. Recetas de forma, en cualquier posición y espejadas (`objetos.js`). |
| ✅ **Herramientas y durabilidad** | Ítems | Velocidad ×2 (madera) y ×4 (piedra) para su tipo de bloque, desgaste de 1 por bloque roto (59 y 131 usos), barrita de desgaste, y la piedra, el adoquín y el ladrillo solo sueltan algo con pico. |
| ✅ **Mejor inventario** (ver abajo) | Ítems | Crafteo integrado, herramientas que no se apilan, y catálogo creativo con pestañas y buscador. |

**"Mejor inventario" = que se parezca más al de Minecraft original** (definición de Max). Estado de cada punto de la lista que se propuso:

- ✅ Cuadrícula de crafteo 2×2 dentro del inventario, con su casilla de resultado.
- ✅ Mesa de crafteo con cuadrícula 3×3.
- ✅ Íconos y nombres para objetos que no son bloques (palos, herramientas).
- ✅ En creativo, un catálogo con pestañas por categoría y buscador.
- ⬜ **Cuatro ranuras de armadura y un muñeco del jugador al lado.** *Se dejó afuera a propósito:* no hay armaduras, así que serían ranuras que no hacen nada. Conviene hacerlo junto con las armaduras.
- ⬜ **Ranura de la mano secundaria.** Igual: no hay nada que ponga en la otra mano todavía.
- ⬜ Estilo visual y comportamiento de los clicks **fieles al original**: ya hay click, click derecho, Shift+click y las teclas 1–9, pero faltan cosas como arrastrar para repartir una pila o el doble click para juntar.

> **Decisiones que tomó la IA donde el roadmap no decía nada** (todas fáciles de cambiar, ver [02-estado-actual.md](02-estado-actual.md#crafteo-y-herramientas)): qué objetos y recetas hay; que la piedra necesite pico (cambia el ritmo del comienzo: con el kit inicial se puede fabricar todo); los números de velocidad y duración (salen de Minecraft); que cada bloque roto gaste un uso aunque no sea el tipo de la herramienta; que no haya "niveles" de herramienta; y que el click derecho sobre una mesa siempre la abra.

### Fase 3 · Mundo más rico ✅

| Función | Depende de | Qué se hizo (2026-11-20) |
|---|---|---|
| ✅ **Cuevas y minerales** | Terreno 3D | Tubos de ruido 3D bajo la superficie (~4% del subsuelo), pozos de entrada, y vetas de **hierro** y **diamante** (bloques 12 y 13). Las cuevas se ven oscuras (la luz del cielo baja bajo un techo). Con los minerales: lingote y diamante, herramientas de hierro y de diamante, y **niveles de herramienta** (el diamante pide pico de hierro). |
| ✅ **Biomas** (desierto, nieve, bosque…) | Más bloques | Cuatro: llanura, bosque, desierto y nevado, con nieve, cactus y abedul como bloques nuevos. Sin cambiar las alturas. *No se cambió el color de la niebla ni del cielo por bioma.* |
| ✅ **Agua que fluye** | — | `agua.js`: niveles de 1 a 7, cascadas, secado. Solo se mueve cuando un bloque cambia junto a ella. |
| ✅ **Estructuras y árboles variados** | Biomas | Cabañas con mesa de crafteo, robles grandes, abedules, pinos y cactus. |

> **Decisiones que tomó la IA donde el roadmap no decía nada** (todas fáciles de cambiar, ver [02-estado-actual.md](02-estado-actual.md)): el mineral de hierro **suelta directo el lingote** (no hay horno ni carbón todavía); las cuevas tienen una luz mínima de 50% (sin antorchas, con menos es injugable: `CONFIG.luzMinima`); el agua no crea fuentes nuevas ni empuja al jugador; el nevado tiene pinos y no hay hielo; la única estructura es la cabaña (aldeas, minas y templos quedan para después); los mundos viejos quedan con costuras (ver limitación 8).

### Fase 4 · Mobs ✅

| Función | Depende de | Qué se hizo (2026-11-20) |
|---|---|---|
| ✅ **Entidades** (sistema base: posición, física, dibujo) | Fase 1 (vida) | `fisica.js` (nuevo): el choque de cajas contra bloques que estaba dentro de `game.js`, ahora compartido por el jugador y los mobs. `mobs.js` (nuevo): cada mob es un objeto con posición, velocidad, caja, vida y un grupo de 5 mallas; los modelos se arman una vez por tipo. |
| ✅ **Animales pasivos, luego enemigos** | Entidades | Cerdo y vaca (pasean al azar, huyen al ser golpeados, sueltan carne) y zombi (de noche persigue y pega; de día se quema). Aparecen solos cerca del jugador hasta `CONFIG.maxMobs`. |
| ✅ **Combate** | Vida, entidades | Click izquierdo sobre un mob (rayo contra las cajas), daño de la mano (1) y de las **espadas** (4 a 7, con desgaste), empujón, botín, y el daño del zombi al jugador (3 por segundo). |

> **Decisiones que tomó la IA donde el roadmap no decía nada** (todas fáciles de cambiar, ver [02-estado-actual.md](02-estado-actual.md)): solo tres mobs (los pasivos son dos y el hostil, uno); la carne se come cruda (no hay horno); los zombis se queman de día en vez de desaparecer; los mobs no se guardan; cualquier arma pega con click mantenido cada 0,5 s (no hay "ataque cargado"); y no hay sonido ni música. Los números (vida, daño, velocidad) salen de Minecraft.

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
| 2026-11-19 | *(decidido por la IA, a revisar)* Comida mínima: solo la manzana. Al morir se conserva el inventario. La inanición no mata. |
| 2026-11-19 | *(decidido por la IA, a revisar)* Varios mundos: cada uno en su carpeta, el menú recarga la página para elegir. |

## Preguntas abiertas

- ¿Qué prioridad real tiene cada función? El orden de arriba es técnico, no necesariamente el que Max quiere.
- ¿Qué cuenta como "PC modesta" en números? Hace falta para medir el requisito de rendimiento.
- ¿Para el multijugador se acepta la recomendación de anfitrión + LAN primero?
- ¿Cuál es el nivel de confianza esperado para los mods (instalar a mano vs. aislados)?
- ¿Se prioriza parecerse a Minecraft o agregar ideas propias cuando la fiel no se pueda?
