# 02 · Estado actual

> Última revisión: 2026-11-19 (después de completar la Fase 1 del roadmap). El código tiene cambios sin commitear desde el commit `398be37`.
> La lista sale de leer el código y se comprobó con pruebas automáticas (ver [06-checklist-pruebas.md](06-checklist-pruebas.md)). Falta lo que depende de un humano; ver "Pendientes de verificar" al final.

## Resumen

Mundos de bloques infinitos en horizontal (se generan alrededor del jugador) con ciclo de día y noche, agua, árboles, sombras, un inventario con objetos que caen al suelo, **vida, hambre, daño por caída y muerte**, y **varios mundos** que se eligen en un menú principal. Se puede explorar, romper y poner bloques, comer manzanas, y la partida se guarda sola. No hay objetivos ni enemigos.

Tamaño: unas 3.300 líneas entre el juego (`src/`), los archivos de Electron y las pruebas (`test/`).

## Cómo correrlo

```powershell
npm install   # solo la primera vez
npm start
```

`npm test` corre 51 pruebas automáticas en unos 30 segundos (ver [06-checklist-pruebas.md](06-checklist-pruebas.md)). F12 abre la consola de desarrollo. Desde la consola, `window.mc` expone el estado del juego (jugador, chunks, inventario, salud, configuración) para experimentar.

## Qué funciona

### Mundo

| Función | Detalle |
|---|---|
| Terreno | Colinas y valles con ruido (fbm de 2 dimensiones). Cada mundo tiene su semilla: aleatoria o la que elijas al crearlo (`1337` si no se indica). Alturas entre 20 y 52 bloques aproximadamente. |
| Tamaño | Infinito en X y Z. Altura fija de 64 bloques. |
| Chunks | Bloques de 16×64×16. Se generan y descargan según la distancia del jugador (6 chunks de radio en calidad media). |
| Capas | Césped arriba, 3 capas de tierra, piedra abajo. Arena en lugar de césped/tierra en la costa. |
| Agua | Lagos poco profundos (máximo 6 bloques, ~15% del terreno) hasta la altura 26. Translúcida y animada. No fluye. |
| Árboles | Aleatorios y reproducibles (misma semilla = mismos árboles). Troncos de 4 a 5 bloques y copa de hojas. |
| Bloques | 10 tipos: césped, tierra, piedra, madera, hojas, arena, tablones, ladrillo, adoquín y agua. Más un objeto que no es bloque: la manzana. |

### Jugador y controles

| Función | Detalle |
|---|---|
| Movimiento | Caminar, correr (Shift), saltar, nadar, volar (F). Colisiones con bloques. |
| Cámara | Primera y tercera persona (V). Balanceo al caminar, golpe al aterrizar, FOV más ancho al correr, niebla azul bajo el agua. |
| Interacción | Romper (click izquierdo mantenido, con grietas progresivas) y poner (click derecho). Alcance de 6 bloques. Contorno negro del bloque apuntado. |
| Personaje | Cuerpo con cabeza, torso, brazos y piernas. En primera persona se ve el brazo con el bloque en la mano. |

Lista completa de teclas en el [README principal](../README.md#controles).

### Salud (solo en supervivencia)

- **Vida y hambre:** de 0 a 20, mostradas como 10 corazones y 10 muslos sobre la barra rápida (dibujados por código, con medios). En creativo la barra se oculta y no hay daño ni hambre; los valores quedan como estaban.
- **Daño por caída:** hasta 3 bloques no duele; después quita `ceil(distancia − 3)` puntos (8 bloques = 5 puntos). Caer al agua o volando no duele. Al recibir daño hay un destello rojo y medio segundo de invulnerabilidad.
- **Hambre:** correr (0,1 por bloque), saltar (0,05; 0,2 corriendo), nadar y romper bloques suman "agotamiento". Cada 4 puntos gastan 1 de saturación y, sin saturación, 1 de hambre. **Caminar solo no cansa.**
- **Regeneración:** con hambre de 18 o más la vida sube 1 cada 4 segundos (y eso cansa). Con hambre 0 la vida baja 1 cada 4 segundos, pero **la inanición nunca mata**: se frena en 1 punto.
- **Comida:** la **manzana** (restaura 4 de hambre). Las hojas la sueltan el 3% de las veces al romperlas, además de lo que ya soltaban. Se come con click derecho teniéndola en la mano, solo si hay hambre, y un click cada 0,8 segundos. No se puede poner como bloque. Hoy se ve como un cubo rojo (los objetos planos son de la Fase 2).
- **Muerte:** al llegar a 0 aparece el cartel "Moriste" con la causa y el botón **Reaparecer**. **Se conserva el inventario** y se reaparece en el punto de partida del mundo.
- Se puede apagar con `CONFIG.hambre` y `CONFIG.danoCaida` en `src/config.js`.

### Inventario

- 36 espacios: barra rápida (1–9) y mochila.
- Pilas de hasta 64.
- Pantalla de inventario (E) con agarrar/soltar, mitad/uno, mover rápido con Shift, y tirar al suelo.
- **Modo supervivencia:** los bloques rotos caen al suelo y se recogen al acercarse; al poner uno se gasta. Se empieza con 16 tablones, 8 ladrillos y 8 adoquines.
- **Modo creativo** (botón en el inventario): catálogo con todos los bloques y la manzana, y nada se gasta.
- Reglas de drops: la piedra suelta adoquín, el césped suelta tierra, las hojas sueltan el 35% de las veces (y a veces una manzana).

### Mundos y menú principal

Al abrir el juego aparece el **menú principal**:

- **Lista de mundos**, el jugado más recientemente primero, con nombre, semilla y fecha. Cada uno tiene **Jugar** y **Borrar** (el borrado pide confirmar con un segundo click y se cancela solo a los 4 segundos).
- **Crear mundo:** nombre (opcional), semilla (opcional: un número se usa tal cual, un texto da siempre el mismo terreno; vacío = aleatoria).
- **Dentro de un mundo**, la pantalla de pausa (Esc) tiene **Guardar y volver al menú**.
- Elegir o crear un mundo **recarga la página** con `?mundo=...`: cada mundo arranca desde cero, sin restos del anterior.
- Los nombres se muestran como texto (un nombre con HTML adentro no se interpreta).
- El menú solo existe dentro de Electron; si se abre `index.html` en un navegador el juego arranca directo, sin guardar.

### Guardado

- **Qué se guarda por mundo:** los cambios al mundo (solo los chunks que modificaste; el resto se regenera de la semilla), el inventario, la ranura elegida, el modo, la hora, dónde estás y hacia dónde mirás, la vida, el hambre y el punto de aparición.
- **Cuándo:** automáticamente cada 30 segundos, al cerrar la ventana, al volver al menú, y una vez apenas se crea un mundo (así aparece en el menú desde el primer momento). Al abrir un mundo se retoma donde lo dejaste (aparece "Partida cargada").
- **Dónde:** en la carpeta de datos de la app, `%APPDATA%\minicraft\mundos\<id>\`, con `mundo.json.gz` (la partida, JSON comprimido), `mundo.respaldo.json.gz` y `meta.json` (nombre, semilla y fechas para el menú). Con un chunk modificado el archivo pesó unos 800 bytes en las pruebas.
- **Migración:** si había una partida de la versión anterior (`mundo.json.gz` suelto en `%APPDATA%\minicraft\`), el menú la mueve sola a un mundo llamado "Mi mundo".
- **Si el archivo se daña:** el juego usa el respaldo, que es una copia del estado con el que abriste la partida. Si los dos están dañados, empieza un mundo nuevo sin romperse.
- **Escritura segura:** se escribe un archivo temporal y después se renombra, así un corte a mitad de guardado no deja la partida a medias.
- **Seguridad:** el identificador de mundo solo admite letras minúsculas, números y guiones (hasta 40), así que la página no puede leer ni borrar archivos fuera de la carpeta de mundos.

### Gráficos

- Texturas de 32×32 generadas por código.
- Sombras reales del sol y la luna, más oscurecimiento en las esquinas (ambient occlusion).
- Ciclo de día y noche de 10 minutos con sol, luna, estrellas, atardecer y niebla de color cambiante.
- Nubes que se desplazan, hojas que se mecen con el viento, partículas al romper.
- Tres presets de calidad (alta, media, baja; tecla K) y resolución adaptativa que baja la resolución sola si los FPS caen.

## Qué NO existe todavía

Estas ausencias son intencionales por ahora y están en el [roadmap](04-roadmap.md):

- Crafteo, herramientas y durabilidad.
- Mobs y combate.
- Cuevas, minerales, biomas, estructuras.
- Multijugador.
- Sonido y música.
- Menú de opciones (el menú principal solo maneja mundos).
- Mods o extensiones.
- Instalador de Windows.

## Limitaciones conocidas (leídas del código)

1. **El menú de mundos es mínimo.** No se puede renombrar ni duplicar un mundo, ni elegir el modo (creativo o supervivencia) al crearlo. Los chunks modificados se mantienen siempre en memoria (`savedChunks`), así que en una sesión muy larga con mucha construcción la memoria crece sin límite.
2. **El agua no fluye.** Es solo relleno hasta el nivel del mar. Romper un bloque junto al agua no la deja entrar.
3. **El terreno es solo un mapa de alturas.** Por eso no hay cuevas ni salientes: cada columna tiene una única superficie.
4. **La generación de chunks corre en el hilo principal.** Hay un presupuesto por frame para no trabar, pero a mayor distancia de visión puede haber tirones.
5. **La capa más baja del mundo (y=0) no se puede romper**, y el fondo del mundo es sólido.
6. **No hay herramientas.** Todos los bloques tardan lo mismo en romperse sin importar lo que tengas en la mano.
7. **Solo Windows está contemplado.** No se probó en otros sistemas.
8. **Si cambia el generador de terreno, los mundos viejos quedan con costuras.** Solo se guardan los chunks modificados; los demás se regeneran con el generador actual, y no encajarían con los viejos. Quien cambie el terreno tiene que decidir qué hacer con los mundos existentes.
9. **Si el juego se cierra mal** (corte de luz, error), se pierde lo hecho desde el último autoguardado (hasta 30 segundos).
10. **Los objetos soltados en el suelo no se guardan.** Al reabrir desaparecen.
11. **Una semilla aleatoria puede dar un punto de partida en el agua.** El juego busca tierra firme hacia un lado; si no encuentra en 120 bloques, aparece en (8, 8) aunque sea agua. No pasó en las pruebas, pero no se revisaron muchas semillas.
12. **La única comida es la manzana**, y sale solo del 3% de las hojas. Sin ella, el hambre baja a 0 y la vida a 1 (no se muere de hambre), pero no se regenera.
13. **Al morir no se pierde nada.** Es una decisión de diseño provisoria (en Minecraft se sueltan los objetos); se puede cambiar.
14. **La manzana se ve como un cubo rojo**, tanto en la mano como en el suelo y en el inventario.
15. **Si reaparecés y algo construido tapa el punto de partida**, el juego te sube hasta un lugar libre; no sabe si quedaste encerrado en una cueva de bloques.

## Pendientes de verificar

El 2026-11-19 se hicieron rondas de pruebas automáticas (detalle en [06-checklist-pruebas.md](06-checklist-pruebas.md)). Max jugó poco y no había visto bugs. Quedan sin probar a mano las cosas que dependen de un humano:

- [ ] Mirar con el mouse y la pausa con Esc (necesitan el bloqueo de puntero).
- [ ] **El aspecto de lo nuevo:** los corazones y muslos, el menú, el cartel de muerte, el destello rojo y la manzana. Las pruebas comprueban que existen y cambian, no que se vean bien.
- [ ] **La sensación de la salud:** si el daño por caída, la velocidad del hambre y la regeneración se sienten bien (los números salen de Minecraft pero no están ajustados a este juego).
- [ ] Medir FPS reales en una PC modesta (el requisito está en [01-vision.md](01-vision.md#requisito-de-rendimiento)).
- [ ] Sensación de juego en general: movimiento, ritmo de romper, alcance.

### Bugs conocidos

Ninguno funcional encontrado. Observaciones:

1. **La resolución adaptativa puede quedarse baja para siempre.** Apunta a 58 FPS fijos (`targetFPS`). En una ventana limitada a 30 FPS el juego bajó solo hasta el 55–60% y no volvió a subir. Una pantalla de 50 Hz o un escritorio remoto podrían tener el mismo efecto. Es de severidad baja y no está confirmado en una PC real.
2. **El agua es poco profunda y rara.** Con las alturas actuales (mínimo 20, nivel del mar 26) el agua tiene como máximo 6 bloques de profundidad y es ~15% de las columnas. No se rompe nada: es una limitación del terreno.
3. **Electron muestra un aviso de seguridad** porque la página no define una política de contenido (CSP). No afecta al juego hoy; conviene resolverlo antes del instalador y de los mods.

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
- **No se midió el costo de la salud ni del menú.** Es poco trabajo por cuadro (actualizar números y 20 imágenes solo cuando cambian), pero no está medido.
