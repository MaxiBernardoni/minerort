# 06 · Checklist de pruebas

> Última revisión: 2026-11-19.
> Leyenda: ✅ anduvo · ⚠️ anduvo con una observación · ⬜ no probado.

## Pruebas automáticas: `npm test`

Desde el 2026-11-19 la mayor parte de este checklist se verifica sola con un comando:

```powershell
npm test                  # corre las 62 pruebas (≈35 segundos)
npm test -- hora          # solo las pruebas cuyo nombre contiene "hora" (admite expresiones regulares)
```

- **Cómo funciona:** `test/run.js` abre el juego real en Electron **sin mostrar ventana** (modo `offscreen`), ejecuta `test/pruebas.js` adentro de la página y sale con código 0 si todo pasó o 1 si algo falló. No instala nada: usa el Electron del proyecto.
- **Qué cubre:**
  - **El juego:** arranque como módulos, cuadros, terreno estable (misma semilla = mismas alturas), caer, saltar, paredes, volar, tercera persona, sombras, romper/poner/recoger bloques, modo creativo, bordes de chunk, todo el inventario, tirar objetos, rueda del mouse, hora y noche, cambio de calidad, nadar bajo el agua y persistencia en memoria al alejarse.
  - **Objetos y la mano:** la manzana es plana (espesor mucho menor que el ancho) en la mano y en el suelo, un bloque es un cubo, y el objeto sostenido queda en la punta del brazo (no a la mitad). Son pruebas de **geometría**: comprueban la forma y la posición, no que se vea bien (para eso está `npm run captura`).
  - **Objetos, recetas y herramientas:** las 9 recetas, con 18 casos (forma, posición en la grilla, espejo, materiales mezclados que no valen, y que el pico no entre en 2×2), crafteo en el inventario (fabricar, consumir, Shift+click, devolver lo que sobra al cerrar), la mesa de crafteo (se abre con click derecho, no pone un bloque, fabrica un pico con 3×3), herramientas (la piedra con la mano no suelta nada y con pico es ~4× más rápida y gasta un uso, cada herramienta acelera solo lo suyo, se rompen al agotarse, no se apilan ni se ponen como bloque y conservan el desgaste al moverlas), el desgaste guardado en la partida, y el catálogo creativo con pestañas y buscador sin acentos. La manzana vieja (id 11) se migra al id 100.
  - **La salud:** daño por caída (3 bloques no duelen, 8 quitan 5, al agua no duele), creativo sin daño y con la barra oculta, la barra con corazones y muslos llenos/medios/vacíos, hambre por correr y saltar (y no por caminar), agotamiento → saturación → hambre, regeneración, inanición que baja a 1 y no mata, comer manzanas (solo con hambre, sin ponerlas como bloque), manzanas de las hojas, y morir y reaparecer (cartel, causa, inventario conservado, vuelve al inicio).
  - **Los mundos:** guardar y reiniciar, archivo dañado, mundo nuevo, menú (lista, crear con semilla y nombre, volver, borrar con confirmación), nombres con HTML mostrados como texto, ids de mundo peligrosos rechazados, migración de la partida anterior y que no haya errores en la consola.
- **Las fases de reinicio y del menú:** la última prueba de `pruebas.js` ("guardar: …") deja un mundo conocido guardado (se juega en el mundo de pruebas `?mundo=prueba`). Después `test/run.js` **reinicia el juego** y corre `test/pruebas-reinicio.js` tres veces: con el archivo bien (la partida vuelve), con el principal dañado (se usa el respaldo) y con los dos dañados (empieza un mundo nuevo sin romperse). Sigue `test/pruebas-menu.js`: abre el menú, crea un mundo por el formulario, vuelve al menú, borra el mundo con confirmación y migra una partida de la versión anterior. Cada paso que recarga la página espera la recarga de verdad. Si filtrás con `npm test -- algo`, estas fases solo corren si el filtro incluye "guardar".
- **Los mundos de las pruebas viven en una carpeta temporal**, así que `npm test` nunca toca tus mundos reales.
- **Se comprobó que detecta roturas** sabotando el código a propósito, en 20 lugares distintos a lo largo del trabajo (los más recientes: la caída que no duele, la inanición que mata, el daño en creativo, correr sin hambre, la manzana que se pone como bloque, las hojas sin manzana, reaparecer sin volver al inicio, no guardar la vida, no validar los ids de mundo, no migrar la partida anterior y mostrar el nombre como HTML). Todas fallaron con un mensaje claro y código 1. Si un cambio falla de forma fea (colgado o con un error técnico en vez de una prueba marcada), mejorá el runner.
- **Lo que se vio en las capturas de la Fase 2 (2026-11-20):** los sprites ampliados (pico en arco, hacha con hoja, pala ovalada; las tres se distinguen después de rediseñar el hacha y la pala, que al principio parecían cucharas), las herramientas sostenidas por el mango con la cabeza hacia arriba, la mesa de crafteo en el mundo (marco y cuadrícula arriba, una herramienta dibujada en los lados), el inventario con la grilla de 2×2, la mesa con la receta del pico y su resultado, las barritas de desgaste, y el catálogo creativo con pestañas y buscador.
- **Lo que se vio en las capturas anteriores (2026-11-20):** el bloque y la manzana en la punta de la mano, la manzana plana con espesor y mirando al jugador, el ícono plano de la manzana en el inventario y la barra con corazones y muslos llenos, medios y vacíos. La manzana en el suelo gira, así que en una foto puede verse de canto.
- **Cómo sabotear sin riesgo:** guardá una copia del archivo con `cp` antes y restaurala con `cp`, verificando con `cmp` (no uses `git checkout` si el archivo todavía no está en git). En archivos del proceso principal (`main.js`, `guardado-main.js`, `preload.js`) el sabotaje tiene que ser un cambio válido: uno que rompa la sintaxis hace que Electron muestre un diálogo de error en la pantalla y deje colgada la prueba.
- **Cómo agregar una prueba:** en `test/pruebas.js`, sumar `await prueba('nombre', async () => { … })` y usar `afirmar(condición, 'mensaje')`. Casi todas empiezan con `await arena()`, que arma una plataforma de piedra a y=60 y deja inventario, hora y calidad en un estado conocido.
- **Si cambiás la generación del terreno a propósito:** la prueba "el terreno es estable" va a fallar; actualizá la lista de alturas de referencia.

**Lo que `npm test` no puede ver:**

- El aspecto: no compara imágenes, así que un cambio de colores, texturas o sombras pasa sin que nadie se entere. **Para eso está `npm run captura`**, que saca PNG de la mano, el suelo, el inventario y la barra de salud para mirarlos (ver [arquitectura](03-arquitectura.md#capturas-cómo-ver-lo-que-dibuja-el-juego)). No es automático: alguien tiene que mirar la imagen. Eso incluye **cómo se ven los corazones, los muslos, el menú, el cartel de muerte, el destello rojo y la manzana**: las pruebas comprueban que existen y cambian, no que se vean bien.
- La **sensación** de la salud: si la caída, el hambre y la regeneración se sienten bien. Los números salen de Minecraft y no están ajustados.
- Mirar con el mouse real, la pausa con Esc y el bloqueo de puntero. Las pruebas ignoran los eventos `pointerlockchange` y manejan ese estado a mano.
- El cierre de la ventana real: `npm test` usa su propio `main`, así que el código de `main.js` que guarda al cerrar no está cubierto. Se probó con un script temporal que arranca el `main.js` real con una carpeta temporal (crear un mundo por la dirección, cerrar la ventana en 61 ms, reabrir y recuperar la torre, las manzanas, la vida y el hambre; abrir el menú y cerrar desde ahí en 27 ms). Conviene repetirlo si se toca `main.js`, `preload.js` o el cierre.
- La sensación de juego y el rendimiento en una PC modesta (el modo `offscreen` no sirve para medir FPS).
- Las animaciones (golpe al aterrizar, balanceo, grietas, partículas) solo se ejecutan, no se evalúan.

Antes de commitear código conviene correr `npm test`. Las tablas de abajo siguen siendo el detalle de lo que se probó la primera vez, y las filas ⬜ son las que necesitan a una persona.

## Cómo se probó la primera vez (a mano, antes de `npm test`)

- El juego se sirvió con un servidor estático local y se abrió en el **navegador integrado** de la app (no en la ventana de Electron).
- Las pruebas se hicieron desde la consola con `window.mc` y con eventos de teclado y mouse simulados. Se saltó el bloqueo de puntero con `mc.setLocked(true)`.
- Sin errores en la consola durante toda la ronda.
- **El panel del navegador tiene que estar visible.** Si está oculto, el navegador no corre los cuadros (0 cuadros en 1.5 s) y las pruebas dan resultados falsos, como "el chunk no se descargó".
- **Límites:** el navegador integrado limita los cuadros a ~30 por segundo y la PC tiene una GPU potente, así que sirve para verificar que las funciones andan, **no** para medir el rendimiento.

La próxima vez conviene repetir esta lista completa después de cambios grandes, y sumar una fila por cada función nueva.

## Mundo

| Prueba | Resultado |
|---|---|
| El juego arranca y genera el mundo inicial (225 chunks) | ✅ |
| El jugador aparece sobre el suelo, sin quedar dentro de bloques | ✅ (aparece junto a árboles) |
| Chunks nuevos al viajar lejos, sin tirones | ✅ peor cuadro 34 ms |
| Chunks lejanos se descargan | ✅ |
| **Lo construido se conserva al alejarse y volver** | ✅ Antes del arreglo una torre de 4 bloques desaparecía; después se conservó la torre y un hoyo cavado, y solo se guardó el chunk modificado. |
| Lo construido se conserva al cerrar y abrir el juego | ✅ Con el guardado en disco (probado con `npm test` y a mano con el `main.js` real). |
| Poner/romper bloques en el borde de un chunk, sin errores | ✅ |
| Agua: nadar, pantalla azul bajo el agua, subir con Espacio | ✅ |
| Agua: velocidad al nadar adelante | ⬜ medición no concluyente |
| Agua profunda y abundante | ⚠️ máximo 6 bloques, ~15% del terreno |

## Jugador

| Prueba | Resultado |
|---|---|
| Caer y aterrizar | ✅ |
| Saltar (altura ≈ 1.37 bloques) | ✅ |
| No atravesar paredes al caminar | ✅ |
| Volar (F) y volver a caminar | ✅ |
| Tercera persona (V) y primera persona | ✅ |
| Cambiar hora (T): suma 3 horas | ✅ |
| Cambiar calidad (K): alta → media → baja | ✅ |
| Sombras (G) | ✅ |
| Mirar con el mouse | ⬜ necesita bloqueo de puntero |
| Pausa con Esc | ⬜ necesita bloqueo de puntero |
| Correr (Shift) y FOV más ancho | ⬜ |
| Golpe al aterrizar y balanceo de cámara | ⬜ (no se pudo verificar a ojo) |

## Bloques e interacción

| Prueba | Resultado |
|---|---|
| Romper piedra mantenido (tardó ≈1.2 s, esperado 1.1) | ✅ |
| Suelta adoquín al romper piedra | ✅ |
| Recoger el objeto soltado al acercarse | ✅ |
| Hojas sueltan con probabilidad | ✅ (una soltó, se vio un drop) |
| Poner bloque y gastar 1 del inventario | ✅ |
| No poner un bloque dentro del jugador | ✅ |
| No romper la capa y=0 | ⬜ solo por lectura del código |
| Grietas progresivas y partículas | ⬜ no verificado a ojo |

## Inventario

| Prueba | Resultado |
|---|---|
| Abrir con E y ocultar la barra | ✅ |
| Click: agarrar y soltar | ✅ |
| Click derecho: tomar la mitad | ✅ |
| Shift+click: mover entre barra y mochila | ✅ |
| Teclas 1–9 sobre un espacio: pasar a la barra | ✅ |
| Cerrar con algo en la mano: vuelve a la mochila | ✅ (no se pierde nada) |
| Inventario lleno: devuelve el sobrante | ✅ |
| Modo creativo: catálogo visible y no se gastan bloques | ✅ |
| Tirar objetos con click fuera del panel | ⬜ |
| Rueda del mouse para elegir ranura | ⬜ |

## Aspecto visual

| Prueba | Resultado |
|---|---|
| Primera persona con brazo y bloque en la mano | ✅ (captura) |
| Tercera persona con el personaje | ✅ (captura) |
| Cielo, nubes, sombras de día | ✅ (captura) |
| Noche, estrellas, luna | ⬜ |
| Atardecer | ⬜ |

## Aplicación

| Prueba | Resultado |
|---|---|
| Arrancar en Electron real (módulos cargados por `file://`) | ✅ Probado sin mostrar la ventana: 225 chunks, sin errores. Solo aparece el aviso de seguridad por falta de CSP. |
| Usar el juego a mano con `npm start` | ⬜ |
| F12 abre las herramientas | ⬜ |
| Rendimiento en una PC modesta | ⬜ |
| Instalador de Windows | ⬜ (no existe todavía) |

## Regresión tras la migración a módulos ES

Mismo conjunto de pruebas repetido después de pasar el código a módulos (2026-11-19). Resultado idéntico al de antes en: caída, salto, pared, vuelo, tercera persona, hora, calidad, sombras, romper, poner, no poner dentro del jugador, recoger, todo el inventario y la persistencia de chunks. Además:

- Cambiar de calidad ajusta la distancia de vista y la niebla (baja: 169 chunks y niebla a 48; media: 80).
- Sin errores en la consola, ni en el navegador ni en Electron.
- Una prueba falló una vez por geometría (el objeto soltado rodó fuera del radio del imán) y pasó al acercarse; no fue un error del código.
- No se pudo usar un analizador estático (eslint) porque necesitaba descargar un paquete. La cobertura de "algo quedó sin importar" depende entonces de haber ejecutado cada ruta; las pruebas de arriba cubren las funciones principales (al romper un bloque se ejecutan también las grietas y las partículas, sin errores), pero **no** cubren todo. No se ejercitaron en esta pasada: el efecto bajo el agua, el modo creativo, tirar objetos con click fuera del panel y la rueda del mouse.

## Hallazgos

Ver "Bugs conocidos" y "Rendimiento medido" en [02-estado-actual.md](02-estado-actual.md#bugs-conocidos).
