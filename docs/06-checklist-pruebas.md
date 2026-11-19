# 06 · Checklist de pruebas

> Última revisión: 2026-11-19.
> Leyenda: ✅ anduvo · ⚠️ anduvo con una observación · ⬜ no probado.

## Pruebas automáticas: `npm test`

Desde el 2026-11-19 la mayor parte de este checklist se verifica sola con un comando:

```powershell
npm test                  # corre las 20 pruebas (≈15 segundos)
npm test -- hora          # solo las pruebas cuyo nombre contiene "hora" (admite expresiones regulares)
```

- **Cómo funciona:** `test/run.js` abre el juego real en Electron **sin mostrar ventana** (modo `offscreen`), ejecuta `test/pruebas.js` adentro de la página y sale con código 0 si todo pasó o 1 si algo falló. No instala nada: usa el Electron del proyecto.
- **Qué cubre:** arranque como módulos, cuadros, terreno estable (misma semilla = mismas alturas), caer, saltar, paredes, volar, tercera persona, sombras, romper/poner/recoger bloques, modo creativo, bordes de chunk, todo el inventario, tirar objetos, rueda del mouse, hora y noche, cambio de calidad, nadar bajo el agua, persistencia en memoria al alejarse y que no haya errores en la consola.
- **Se comprobó que detecta roturas** sabotando el código a propósito: sin guardar chunks, con un export faltante y con otra velocidad de salto. Las tres veces falló con un mensaje claro y código 1.
- **Cómo agregar una prueba:** en `test/pruebas.js`, sumar `await prueba('nombre', async () => { … })` y usar `afirmar(condición, 'mensaje')`. Casi todas empiezan con `await arena()`, que arma una plataforma de piedra a y=60 y deja inventario, hora y calidad en un estado conocido.
- **Si cambiás la generación del terreno a propósito:** la prueba "el terreno es estable" va a fallar; actualizá la lista de alturas de referencia.

**Lo que `npm test` no puede ver:**

- El aspecto: no compara imágenes, así que un cambio de colores, texturas o sombras pasa sin que nadie se entere.
- Mirar con el mouse real, la pausa con Esc y el bloqueo de puntero. Las pruebas ignoran los eventos `pointerlockchange` y manejan ese estado a mano.
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
| Lo construido se conserva al cerrar y abrir el juego | ⚠️ No: no hay guardado en disco todavía. |
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
