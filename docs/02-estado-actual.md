# 02 · Estado actual

> Última revisión: 2026-11-19 · Corresponde al commit `e69a868` (versión 0.1.0).
> La lista sale de leer el código y se comprobó con pruebas automáticas el 2026-11-19 (ver [06-checklist-pruebas.md](06-checklist-pruebas.md)). Falta lo que depende de un humano; ver "Pendientes de verificar" al final.

## Resumen

Un mundo de bloques infinito en horizontal (se genera alrededor del jugador) con ciclo de día y noche, agua, árboles, sombras, y un inventario con objetos que caen al suelo. Se puede explorar, romper y poner bloques. No hay objetivos, enemigos ni guardado.

Tamaño: unas 1.950 líneas en 11 archivos, más `package.json` y README.

## Cómo correrlo

```powershell
npm install   # solo la primera vez
npm start
```

`npm test` corre 20 pruebas automáticas en unos 15 segundos (ver [06-checklist-pruebas.md](06-checklist-pruebas.md)). F12 abre la consola de desarrollo. Desde la consola, `window.mc` expone el estado del juego (jugador, chunks, inventario, configuración) para experimentar.

## Qué funciona

### Mundo

| Función | Detalle |
|---|---|
| Terreno | Colinas y valles con ruido (fbm de 2 dimensiones), semilla fija `1337`. Alturas entre 20 y 52 bloques aproximadamente. |
| Tamaño | Infinito en X y Z. Altura fija de 64 bloques. |
| Chunks | Bloques de 16×64×16. Se generan y descargan según la distancia del jugador (6 chunks de radio en calidad media). |
| Capas | Césped arriba, 3 capas de tierra, piedra abajo. Arena en lugar de césped/tierra en la costa. |
| Agua | Lagos poco profundos (máximo 6 bloques, ~15% del terreno) hasta la altura 26. Translúcida y animada. No fluye. |
| Árboles | Aleatorios y reproducibles (misma semilla = mismos árboles). Troncos de 4 a 5 bloques y copa de hojas. |
| Bloques | 10 tipos: césped, tierra, piedra, madera, hojas, arena, tablones, ladrillo, adoquín y agua. |

### Jugador y controles

| Función | Detalle |
|---|---|
| Movimiento | Caminar, correr (Shift), saltar, nadar, volar (F). Colisiones con bloques. |
| Cámara | Primera y tercera persona (V). Balanceo al caminar, golpe al aterrizar, FOV más ancho al correr, niebla azul bajo el agua. |
| Interacción | Romper (click izquierdo mantenido, con grietas progresivas) y poner (click derecho). Alcance de 6 bloques. Contorno negro del bloque apuntado. |
| Personaje | Cuerpo con cabeza, torso, brazos y piernas. En primera persona se ve el brazo con el bloque en la mano. |

Lista completa de teclas en el [README principal](../README.md#controles).

### Inventario

- 36 espacios: barra rápida (1–9) y mochila.
- Pilas de hasta 64.
- Pantalla de inventario (E) con agarrar/soltar, mitad/uno, mover rápido con Shift, y tirar al suelo.
- **Modo supervivencia:** los bloques rotos caen al suelo y se recogen al acercarse; al poner uno se gasta. Se empieza con 16 tablones, 8 ladrillos y 8 adoquines.
- **Modo creativo** (botón en el inventario): catálogo con todos los bloques y nada se gasta.
- Reglas de drops: la piedra suelta adoquín, el césped suelta tierra, las hojas sueltan el 35% de las veces.

### Gráficos

- Texturas de 32×32 generadas por código.
- Sombras reales del sol y la luna, más oscurecimiento en las esquinas (ambient occlusion).
- Ciclo de día y noche de 10 minutos con sol, luna, estrellas, atardecer y niebla de color cambiante.
- Nubes que se desplazan, hojas que se mecen con el viento, partículas al romper.
- Tres presets de calidad (alta, media, baja; tecla K) y resolución adaptativa que baja la resolución sola si los FPS caen.

## Qué NO existe todavía

Estas ausencias son intencionales por ahora y están en el [roadmap](04-roadmap.md):

- **Guardado y carga de mundos en disco.** Los cambios sí se conservan en memoria durante la sesión; ver la limitación #1 más abajo.
- Crafteo, herramientas y durabilidad.
- Mobs, vida, hambre, daño de caída.
- Cuevas, minerales, biomas, estructuras.
- Multijugador.
- Sonido y música.
- Menú principal y menú de opciones (solo hay una pantalla de pausa con la lista de controles).
- Mods o extensiones.
- Instalador de Windows.

## Limitaciones conocidas (leídas del código)

1. **Los cambios al mundo se pierden al cerrar el juego.** Mientras jugás se conservan aunque te alejes (los chunks modificados se guardan en memoria en `savedChunks`, ver [03-arquitectura.md](03-arquitectura.md)), pero no hay guardado en disco. Además esa memoria crece con cada chunk modificado y no se limpia.
2. **El agua no fluye.** Es solo relleno hasta el nivel del mar. Romper un bloque junto al agua no la deja entrar.
3. **El terreno es solo un mapa de alturas.** Por eso no hay cuevas ni salientes: cada columna tiene una única superficie.
4. **La generación de chunks corre en el hilo principal.** Hay un presupuesto por frame para no trabar, pero a mayor distancia de visión puede haber tirones.
5. **La capa más baja del mundo (y=0) no se puede romper**, y el fondo del mundo es sólido.
6. **No hay herramientas.** Todos los bloques tardan lo mismo en romperse sin importar lo que tengas en la mano.
7. **Solo Windows está contemplado.** No se probó en otros sistemas.

## Pendientes de verificar

El 2026-11-19 se hizo una primera ronda de pruebas automáticas (detalle en [06-checklist-pruebas.md](06-checklist-pruebas.md)). Max jugó poco y no había visto bugs. Quedan sin probar a mano las cosas que dependen de un humano y de la app real:

- [ ] Mirar con el mouse y la pausa con Esc (necesitan el bloqueo de puntero).
- [ ] Correr con `npm start` (las pruebas se hicieron en un navegador, no en la ventana de Electron).
- [ ] Medir FPS reales en una PC modesta (el requisito está en [01-vision.md](01-vision.md#requisito-de-rendimiento)).
- [ ] Sensación de juego: si el movimiento, el ritmo de romper y el alcance se sienten bien.

### Bugs conocidos

Ninguno funcional encontrado en la primera ronda. Observaciones:

1. **La resolución adaptativa puede quedarse baja para siempre.** Apunta a 58 FPS fijos (`targetFPS`). En una ventana limitada a 30 FPS el juego bajó solo hasta el 55–60% y no volvió a subir. Una pantalla de 50 Hz o un escritorio remoto podrían tener el mismo efecto. Es de severidad baja y no está confirmado en una PC real.
2. **El agua es poco profunda y rara.** El README y las secciones anteriores hablan de "lagos y mar", pero con las alturas actuales (mínimo 20, nivel del mar 26) el agua tiene como máximo 6 bloques de profundidad y es ~15% de las columnas. No se rompe nada: es una limitación del terreno.
3. ~~Los cambios al mundo se perdían al alejarse.~~ **Resuelto** el 2026-11-19: ahora se conservan durante la sesión. Siguen perdiéndose al cerrar el juego (limitación #1).
4. **Electron muestra un aviso de seguridad** porque la página no define una política de contenido (CSP). No afecta al juego hoy; conviene resolverlo antes del instalador y de los mods.

### Rendimiento medido

| Fecha | PC | Preset | Resultado | Notas |
|---|---|---|---|---|
| 2026-11-19 | RTX 3070, ventana de 1024×768 | baja | ~1.5 ms por cuadro | Mediana de 40 cuadros forzando la sincronización con la GPU. |
| 2026-11-19 | ídem | media | ~2.9 ms por cuadro | Sombras actualizadas en cada cuadro (peor caso). |
| 2026-11-19 | ídem | alta | ~2.8 ms por cuadro | Ídem. |

- Esta GPU es potente, así que **no dice nada sobre una PC modesta**: el requisito sigue sin medirse.
- Los FPS que mostró el juego (30) no son confiables: el navegador integrado limita los cuadros a ~30 por segundo.
- Al viajar a una zona nueva (225 chunks cargados) no hubo tirones: el peor cuadro duró 34 ms.
- Presets: `baja` dibuja unas 80 llamadas y 64k triángulos, `media` 144 y 132k, `alta` 160 y 255k.
