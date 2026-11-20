# 02 · Estado actual

> Última revisión: 2026-11-20 (después de completar la Fase 5 del roadmap). El código tiene cambios sin commitear desde el commit `76eb7fd` (la Fase 2).
> La lista sale de leer el código y se comprobó con pruebas automáticas (ver [06-checklist-pruebas.md](06-checklist-pruebas.md)). Falta lo que depende de un humano; ver "Pendientes de verificar" al final.

## Resumen

Mundos de bloques infinitos en horizontal (se generan alrededor del jugador) con **cuatro biomas, cuevas con minerales, agua que fluye, cabañas y mobs (cerdos, vacas y zombis)**, ciclo de día y noche, árboles, sombras, un inventario con objetos que caen al suelo, **vida, hambre, daño por caída y muerte**, y **varios mundos** que se eligen en un menú principal. Se puede explorar, romper y poner bloques, comer manzanas, **craftear** (en el inventario y en una **mesa de crafteo**) y **fabricar herramientas** que se desgastan, y la partida se guarda sola. Con los minerales hay herramientas de hierro y de diamante, y con las espadas se pelea contra los zombis que salen de noche. No hay objetivos.

Tamaño: unas 4.000 líneas entre el juego (`src/`), los archivos de Electron y las pruebas (`test/`).

## Cómo correrlo

```powershell
npm install   # solo la primera vez
npm start
npm run empaquetar   # arma el instalador de Windows en dist/ (ver "Instalador de Windows")
```

`npm test` corre 80 pruebas automáticas en alrededor de un minuto (ver [06-checklist-pruebas.md](06-checklist-pruebas.md)), y `npm run captura` saca capturas del juego para mirar cómo se ve. F12 abre la consola de desarrollo. Desde la consola, `window.mc` expone el estado del juego (jugador, chunks, inventario, salud, configuración) para experimentar.

## Qué funciona

### Mundo

| Función | Detalle |
|---|---|
| Terreno | Colinas y valles con ruido (fbm de 2 dimensiones). Cada mundo tiene su semilla: aleatoria o la que elijas al crearlo (`1337` si no se indica). Alturas entre 20 y 52 bloques aproximadamente. Por debajo de la superficie hay cuevas (ver abajo). |
| Tamaño | Infinito en X y Z. Altura fija de 64 bloques. |
| Chunks | Bloques de 16×64×16. Se generan y descargan según la distancia del jugador (6 chunks de radio en calidad media). |
| Capas | Césped arriba (o arena o nieve, según el bioma), 3 capas de tierra, piedra abajo. Arena en lugar de césped/tierra en la costa. |
| Biomas | **Llanura, bosque, desierto y nevado**, repartidos con ruido de temperatura y humedad (ver abajo). |
| Agua | Lagos poco profundos (máximo 6 bloques, ~15% del terreno) hasta la altura 26. Translúcida y animada. **Fluye** si se rompe lo que la contiene (ver abajo). |
| Árboles | Aleatorios y reproducibles (misma semilla = mismos árboles). Según el bioma: robles (4 a 5 de alto), robles grandes, abedules, pinos y cactus. |
| Estructuras | **Cabañas** de tablones con puerta, ventanas y una mesa de crafteo adentro (ver abajo). |
| Bloques | 16 tipos: césped, tierra, piedra, madera, hojas, arena, tablones, ladrillo, adoquín, agua, mesa de crafteo, **mineral de hierro, mineral de diamante, nieve, cactus y abedul**. El agua que fluye usa 7 ids más (20 a 26, ver abajo). |
| Objetos | 23 cosas que no son bloques (no se ponen en el mundo): manzana, palo, lingote de hierro, diamante, **carne**, y pico, hacha, pala y **espada** de madera, de piedra, de hierro y de diamante. |
| Mobs | **Cerdo, vaca y zombi** (ver abajo). |

### Cuevas y minerales

- **Cuevas:** tubos de ruido 3D (dos superficies que se cruzan) bajo la superficie: ~4% del subsuelo es aire. Siempre dejan **4 bloques de techo** bajo el fondo de los lagos y del mar, así que no se vacían. Algunas asoman en las laderas, y hay **pozos de entrada** (columnas angostas de hasta 12 bloques que bajan de la superficie hasta un túnel). Cuidado: caer por uno duele.
- **Oscuridad:** el techo de cada columna (el bloque opaco más alto) oscurece lo que tiene debajo, `CONFIG.luzPorBloque` (10%) por bloque hasta `CONFIG.luzMinima` (50%). No hay antorchas todavía, así que las cuevas se ven tenues pero no negras.
- **Minerales:** vetas de **hierro** (3 a 7 bloques, de y=4 a 44, unos 7 intentos por chunk) y de **diamante** (2 a 4 bloques, de y=3 a 14, rara: ~40% de los chunks). Solo reemplazan piedra.
- **Niveles de herramienta:** el mineral de hierro pide **pico de piedra o mejor**; el de diamante, **pico de hierro o mejor**. Con una herramienta que no alcanza, el bloque se rompe (lento, a mano) pero no suelta nada.
- **No hay horno:** el mineral de hierro suelta directo el **lingote** (decisión provisoria hasta tener hornos).

### Biomas

| Bioma | Superficie | Árboles |
|---|---|---|
| Llanura | césped | casi ninguno; a veces un roble o un abedul |
| Bosque | césped | tres veces más árboles: robles, robles grandes (6 a 7 de alto) y abedules (tronco blanco) |
| Desierto | arena (3 capas) | cactus de 2 a 4 bloques, sin hojas |
| Nevado | nieve sobre tierra | pinos (tronco alto y copa en cono) |

- La temperatura baja da nevado, la alta desierto, y en el medio la humedad separa bosque de llanura. Con la semilla 1337 salen ~30% llanura, ~34% bosque, ~19% desierto y ~17% nevado. Las costas siguen siendo de arena.
- **Por encima de la altura 47 todo es nieve** (con pinos), menos en el desierto.

### Cabañas

Una por cada tanto: en una grilla de celdas de 48×48 bloques, ~30% tienen una cabaña, siempre que el lugar sea llano (5 puntos con menos de 4 bloques de diferencia), esté a más de 2 bloques sobre el mar y no sea del bioma nevado. De 7×7 con piso y techo de tablones, esquinas de madera, paredes de tablones, un borde de adoquín en el techo, **puerta** (2 bloques de alto, sin hoja) en un lado, **ventanas** sin vidrio en los otros tres y una **mesa de crafteo** adentro. Tiene cimientos de adoquín hasta el terreno. Son raras (~1 cada 100 chunks).

### Agua que fluye

- **Ids:** 10 es la **fuente** y 20 a 26 los niveles 1 a 7 de agua que fluye (el 1 es el más cercano a la fuente). Alto del agua: baja un poco con el nivel.
- **Reglas** (`src/agua.js`, cada 0,2 segundos): una celda de aire o agua que fluye toma el nivel que le toca según sus vecinos. Hay agua arriba → nivel 1 (cae); una fuente al costado → nivel 1; agua que fluye al costado → su nivel + 1, hasta el 7, donde se corta. **El agua sobre un hueco (aire o agua que fluye) cae en vez de abrirse de costado**, así una fuente en el aire da una cascada y al llegar al suelo se abre. Sin nada que la alimente se va secando de a un nivel por paso.
- **Cuándo se activa:** solo cuando un bloque cambia junto al agua (romper la orilla de un lago, poner o sacar un bloque en su camino). Un lago sin tocar no se mueve. El agua no se crea de la nada: **no hay fuentes nuevas**, solo se abre la que ya existía, y no hay cubos para recogerla ni ponerla.
- **Costo:** hasta 400 celdas por paso, y las mallas se rehacen una vez por chunk al final.
- Se nada en el agua que fluye igual que en la fuente. No hay corriente que te empuje.

### Mobs y combate

Tres criaturas dibujadas con cajas de color (sin imágenes), cada una con 5 mallas (cuerpo y 4 miembros):

| Mob | Vida | Qué hace | Botín |
|---|---|---|---|
| Cerdo | 10 | pasea al azar; si lo golpeás, huye 4 segundos | 1 o 2 de carne |
| Vaca | 10 | igual que el cerdo | 1 a 3 de carne |
| Zombi | 20 | **persigue** al jugador a menos de 24 bloques y le pega **3 puntos por segundo** al tocarlo; salta escalones de 1 bloque; **se quema de día** (2 puntos por segundo) si le da el sol, y no si tiene un techo | 15%: un lingote de hierro (quemado, nada) |

- **Aparición:** hasta `CONFIG.maxMobs` (12) vivos a la vez. Cada 0,3 s al principio (después, cada 1,5 s) se intenta un lugar al azar en la superficie, entre 18 y 44 bloques del jugador (los zombis, entre 14 y 32). **Animales:** a cualquier hora, solo sobre césped, hasta 6. **Zombis:** solo de noche (`daylight < 0.4`), hasta 4. Un mob a más de 80 bloques desaparece, y uno sobre un chunk sin cargar espera quieto. `CONFIG.mobs = false` los apaga.
- **Pegar:** apuntar a un mob a menos de 3,5 bloques (`CONFIG.reachMobs`; un bloque en el medio lo tapa) y mantener el click izquierdo: un golpe cada 0,5 segundos, sin romper el bloque de atrás. La mano pega 1 punto; las **espadas** de madera, piedra, hierro y diamante pegan 4, 5, 6 y 7 (con 59, 131, 250 y 1561 usos; cada golpe gasta uno). El golpe empuja al mob, lo pone rojo un momento y cansa un poco. Al morir se cae de costado y desaparece soltando su botín (en creativo no suelta nada).
- **Carne:** sale de cerdos y vacas; se come con click derecho y restaura 6 de hambre. Sin horno, se come cruda.
- **Daño al jugador:** el zombi quita 3 puntos (1,5 corazones) cada 1 segundo cuando está a menos de 1,1 bloques. El cartel dice "Te mató un zombi". En creativo no hace nada.
- **Los mobs no se guardan en la partida:** al abrir un mundo aparecen otros.
- **Física:** la misma de `fisica.js` que usa el jugador (cajas contra bloques, gravedad, flotar en el agua), en pasos de 25 ms para que caer rápido no atraviese el piso.

### Jugador y controles

| Función | Detalle |
|---|---|
| Movimiento | Caminar, correr (Shift), saltar, nadar, volar (F). Colisiones con bloques. |
| Cámara | Primera y tercera persona (V). Balanceo al caminar, golpe al aterrizar, FOV más ancho al correr, niebla azul bajo el agua. |
| Interacción | Romper (click izquierdo mantenido, con grietas progresivas) y poner (click derecho). Alcance de 6 bloques. Contorno negro del bloque apuntado. Apuntando a un mob, el click izquierdo le pega. |
| Personaje | Cuerpo con cabeza, torso, brazos y piernas. En primera persona se ve el brazo y, en la punta (la mano), el bloque u objeto que sostenés: un cubo para los bloques, un sprite plano para los objetos. |

Lista completa de teclas en el [README principal](../README.md#controles).

### Salud (solo en supervivencia)

- **Vida y hambre:** de 0 a 20, mostradas como 10 corazones y 10 muslos sobre la barra rápida (dibujados por código, con medios). En creativo la barra se oculta y no hay daño ni hambre; los valores quedan como estaban.
- **Daño por caída:** hasta 3 bloques no duele; después quita `ceil(distancia − 3)` puntos (8 bloques = 5 puntos). Caer al agua o volando no duele. Al recibir daño hay un destello rojo y medio segundo de invulnerabilidad.
- **Hambre:** correr (0,1 por bloque), saltar (0,05; 0,2 corriendo), nadar y romper bloques suman "agotamiento". Cada 4 puntos gastan 1 de saturación y, sin saturación, 1 de hambre. **Caminar solo no cansa.**
- **Regeneración:** con hambre de 18 o más la vida sube 1 cada 4 segundos (y eso cansa). Con hambre 0 la vida baja 1 cada 4 segundos, pero **la inanición nunca mata**: se frena en 1 punto.
- **Comida:** la **manzana** (restaura 4 de hambre). Las hojas la sueltan el 3% de las veces al romperlas, además de lo que ya soltaban. Se come con click derecho teniéndola en la mano, solo si hay hambre, y un click cada 0,8 segundos. No se puede poner como bloque. Es un **objeto plano con espesor** (un sprite de 16×16, como en Minecraft), no un cubo: se ve así en la mano, en el suelo (gira) y en el inventario.
- **Muerte:** al llegar a 0 aparece el cartel "Moriste" con la causa y el botón **Reaparecer**. **Se conserva el inventario** y se reaparece en el punto de partida del mundo.
- Se puede apagar con `CONFIG.hambre` y `CONFIG.danoCaida` en `src/config.js`.

### Inventario

- 36 espacios: barra rápida (1–9) y mochila.
- Pilas de hasta 64.
- Pantalla de inventario (E) con agarrar/soltar, mitad/uno, mover rápido con Shift, y tirar al suelo.
- **Modo supervivencia:** los bloques rotos caen al suelo y se recogen al acercarse; al poner uno se gasta. Se empieza con 16 tablones, 8 ladrillos y 8 adoquines.
- **Modo creativo** (botón en el inventario): catálogo con todos los bloques y objetos, y nada se gasta. Tiene pestañas **Todo / Bloques / Objetos** y un **buscador** que ignora los acentos ("adoquin" encuentra "Adoquín").
- Reglas de drops: la piedra suelta adoquín (solo si la rompés con pico, ver abajo), el césped suelta tierra, las hojas sueltan el 35% de las veces (y a veces una manzana).
- Las herramientas **no se apilan** (una por casilla) y conservan su desgaste al moverlas, tirarlas, recogerlas y guardar la partida.

### Crafteo y herramientas

- **Dónde:** en el inventario (tecla E) hay una grilla de **2×2**; con **click derecho sobre una mesa de crafteo** se abre una de **3×3**. Cada una tiene una casilla de resultado.
- **Cómo:** poné ingredientes en la grilla (click o click derecho para de a uno). El resultado aparece solo; click en él lo saca (se gasta una unidad de cada ingrediente), Shift+click fabrica todo lo que se pueda y lo manda a la mochila. Al cerrar, lo que quedó en la grilla vuelve a la mochila.
- **Las recetas son de forma:** se reconocen en cualquier posición de la grilla y también espejadas (el hacha sirve para zurdos).

| Receta | Forma | Resultado |
|---|---|---|
| Tablones | 1 madera | 4 tablones |
| Palos | 2 tablones, uno sobre otro | 4 palos |
| Mesa de crafteo | 4 tablones en cuadrado (2×2) | 1 mesa |
| Pico | 3 tablones (o adoquines, lingotes o diamantes) arriba y 2 palos al medio y abajo | pico de madera (o de piedra, de hierro, de diamante) |
| Hacha | tablones (o adoquines) en `XX / XP / .P` | hacha de madera (o de piedra) |
| Pala | 1 tablón (o adoquín) sobre 2 palos | pala de madera (o de piedra) |
| Espada | 2 tablones (o adoquines, lingotes o diamantes) uno sobre otro, y 1 palo debajo | espada de madera (o de piedra, de hierro, de diamante) |
| Herramientas de hierro y de diamante | Las mismas formas con **lingotes de hierro** o **diamantes** | pico, hacha y pala de hierro o de diamante |

- **Herramientas:** el pico acelera piedra, adoquín, ladrillo y minerales; el hacha, madera, tablones, mesa y abedul; la pala, tierra, césped, arena y nieve. Madera ×2 y 59 usos; piedra ×4 y 131; **hierro ×6 y 250; diamante ×8 y 1561**. Las **espadas** no rompen nada más rápido: pegan 4, 5, 6 y 7 puntos y gastan un uso por golpe. Cada bloque que rompés con una herramienta le gasta un uso (con cualquier bloque, aunque no sea el suyo). Al agotarse se rompe. En el inventario se ve una **barrita de desgaste** (verde → roja) y el aviso de usos que quedan al pasar el mouse.
- **La piedra, el adoquín y el ladrillo solo sueltan algo si los rompés con pico.** Sin pico se rompen pero no dan nada. Con el kit inicial (16 tablones y 8 adoquines) ya se puede fabricar todo lo necesario.
- Una herramienta no se puede poner como bloque ni comer.

### Instalador de Windows

- **Cómo se arma:** `npm run empaquetar` (electron-builder, instalador NSIS) deja `dist\MiniCraft-Setup-0.1.0.exe` (unos 84 MB; instalado ocupa unos 270 MB, casi todo Electron/Chromium). `npm run empaquetar:carpeta` arma solo la carpeta `dist\win-unpacked` (sin instalador, más rápido). La primera vez descarga Electron y las herramientas de NSIS (internet).
- **Qué hace al instalar:** pregunta la carpeta (por defecto, en `%LOCALAPPDATA%\Programs`; **no pide administrador**), crea un acceso en el menú Inicio y otro en el escritorio, y abre el juego al terminar. El desinstalador está en "Aplicaciones instaladas" y **no borra tus mundos**: siguen en `%APPDATA%\minicraft\mundos\`.
- **Mismos mundos que `npm start`:** el juego instalado usa la misma carpeta de datos, así que ve los mundos de la versión de desarrollo.
- **Qué lleva adentro:** solo el juego (`index.html`, `main.js`, `preload.js`, `guardado-main.js`, `src/`) y `three.module.js`. No lleva pruebas, documentación ni capturas. La lista está en `build.files` de `package.json`.
- **Icono:** `build/icon.png` (un bloque de césped) lo dibuja `tools/hacer-icono.js` por código; electron-builder lo convierte en `.ico`.
- **Cómo se prueba:** `npm run probar-empaquetado` (con la carpeta armada) abre el juego empaquetado con una carpeta de datos temporal, comprueba el menú, que se genere el mundo, que guarde en disco y que no haya errores en la consola. Con `MINICRAFT_EXE` se prueba un juego ya instalado.
- **Sin firmar:** Windows SmartScreen va a mostrar "Windows protegió su PC" al abrir el instalador de otra persona (Más información → Ejecutar de todas formas). Firmarlo requiere un certificado de pago.

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

- Armaduras, mano secundaria y el muñeco del jugador en el inventario (el original los tiene; se dejaron afuera porque no hay armaduras ni segunda mano, y serían una interfaz que no hace nada).
- Más recetas y materiales: no hay horno ni carbón, ni antorchas ni armaduras.
- Más mobs (ovejas, gallinas, esqueletos, arañas…), arcos, y que los animales se reproduzcan o se puedan alimentar.
- Más estructuras (aldeas, minas, templos), lava, ríos, océanos profundos.
- Multijugador.
- Sonido y música.
- Menú de opciones (el menú principal solo maneja mundos).
- Mods o extensiones.

## Limitaciones conocidas (leídas del código)

1. **El menú de mundos es mínimo.** No se puede renombrar ni duplicar un mundo, ni elegir el modo (creativo o supervivencia) al crearlo. Los chunks modificados se mantienen siempre en memoria (`savedChunks`), así que en una sesión muy larga con mucha construcción la memoria crece sin límite.
2. **El agua fluye, pero con límites.** No hay fuentes nuevas (no se genera agua infinita), no hay corriente que empuje al jugador, y el agua solo se actualiza cuando un bloque cambia junto a ella. Si el agua llega a un chunk sin cargar, no sigue hasta que vuelvas.
3. **Las cuevas son tubos.** No hay cavernas grandes, cañones ni lava. El **terreno de la superficie sigue siendo un mapa de alturas**: no hay salientes ni arcos en la superficie.
4. **La generación de chunks corre en el hilo principal.** Hay un presupuesto por frame para no trabar, pero a mayor distancia de visión puede haber tirones.
5. **La capa más baja del mundo (y=0) no se puede romper**, y el fondo del mundo es sólido.
6. **Hay pocas herramientas y recetas** (ver "Crafteo y herramientas"). El "nivel" de herramienta solo importa para el hierro y el diamante: la piedra y el ladrillo los rompe y recoge cualquier pico.
7. **Solo Windows está contemplado.** No se probó en otros sistemas.
8. **Si cambia el generador de terreno, los mundos viejos quedan con costuras.** Solo se guardan los chunks modificados; los demás se regeneran con el generador actual, y no encajarían con los viejos. Quien cambie el terreno tiene que decidir qué hacer con los mundos existentes. **La Fase 3 lo cambió** (biomas, cuevas, árboles, cabañas): un mundo creado antes tiene sus chunks modificados con el terreno viejo, y al lado el nuevo. Las alturas no cambiaron, así que las costuras son de bloques (césped contra nieve, un árbol cortado), no escalones.
9. **Si el juego se cierra mal** (corte de luz, error), se pierde lo hecho desde el último autoguardado (hasta 30 segundos).
10. **Los objetos soltados en el suelo no se guardan.** Al reabrir desaparecen.
11. **Una semilla aleatoria puede dar un punto de partida en el agua.** El juego busca tierra firme hacia un lado; si no encuentra en 120 bloques, aparece en (8, 8) aunque sea agua. No pasó en las pruebas, pero no se revisaron muchas semillas.
12. **La única comida es la manzana**, y sale solo del 3% de las hojas. Sin ella, el hambre baja a 0 y la vida a 1 (no se muere de hambre), pero no se regenera.
13. **Al morir no se pierde nada.** Es una decisión de diseño provisoria (en Minecraft se sueltan los objetos); se puede cambiar.
14. **Si reaparecés y algo construido tapa el punto de partida**, el juego te sube hasta un lugar libre; no sabe si quedaste encerrado en una cueva de bloques.
15. **No se puede poner un bloque apuntando a una mesa de crafteo**: el click derecho sobre ella siempre la abre (en Minecraft se evita agachándose; acá hay que apuntar a otro bloque).
16. **En tercera persona el personaje no sostiene nada** en la mano; solo se ve en primera persona.
17. **Las recetas no se pueden descubrir desde el juego** (no hay libro de recetas): hoy están en este documento y en `src/objetos.js`.
18. **Sin horno ni antorchas.** El mineral de hierro suelta directo el lingote, y las cuevas son tenues pero no hay forma de iluminarlas. La luz bajo tierra solo mira cuántos bloques tenés arriba (no hay luz que entre de costado por la boca de una cueva).
19. **Los pozos de entrada a las cuevas son caídas de hasta 12 bloques**, que duelen (hasta 9 puntos) y no tienen forma de subir salvo cavando.
20. **Un cactus no hace daño**, y la nieve y la arena no caen por gravedad.
21. **Los mobs no se guardan.** Al reabrir un mundo desaparecen los de antes y aparecen otros.
22. **La IA es muy simple.** Los animales caminan al azar y caen de los acantilados sin dolor; un zombi no busca caminos (si hay una pared de 2 bloques se queda empujándola un rato y después prueba otro rumbo); no hay sonidos, ni reproducción, ni comida para animales.
23. **Los mobs no chocan entre sí ni con el jugador**: se superponen.
24. **Los zombis solo aparecen en la superficie**, no en cuevas ni de día en la sombra (el sol solo los quema, no limita dónde aparecen).
25. **Los mobs cuestan FPS** (5 mallas por mob, el doble con sombras; 12 mobs son ~60 mallas más) y **no se midió en una PC modesta**. `CONFIG.maxMobs` es la perilla.
26. **El instalador es solo para Windows de 64 bits, sin firmar y sin actualización automática.** La versión es siempre 0.1.0 (`package.json`): subirla cambia el nombre del instalador. Cada instalación nueva es una copia entera de 270 MB.
27. **El primer arranque después de armar un .exe nuevo se colgó en esta PC** (sin ningún mensaje, quizá el antivirus revisándolo) y el segundo anduvo siempre. `tools/probar-empaquetado.js` reintenta solo.

## Pendientes de verificar

El 2026-11-19 se hicieron rondas de pruebas automáticas (detalle en [06-checklist-pruebas.md](06-checklist-pruebas.md)). Max jugó poco y no había visto bugs. Quedan sin probar a mano las cosas que dependen de un humano:

- [ ] Mirar con el mouse y la pausa con Esc (necesitan el bloqueo de puntero).
- [ ] **El aspecto de lo nuevo:** los corazones y muslos, el menú, el cartel de muerte, el destello rojo y la manzana. Las pruebas comprueban que existen y cambian, no que se vean bien.
- [ ] **La sensación de la salud:** si el daño por caída, la velocidad del hambre y la regeneración se sienten bien (los números salen de Minecraft pero no están ajustados a este juego).
- [ ] Medir FPS reales en una PC modesta (el requisito está en [01-vision.md](01-vision.md#requisito-de-rendimiento)).
- [ ] Sensación de juego en general: movimiento, ritmo de romper, alcance.
- [ ] **El aspecto y la sensación de lo nuevo de la Fase 2:** los sprites de las herramientas, cómo se sostienen en la mano, la mesa de crafteo, las pantallas de crafteo y las barritas de desgaste. Se miraron en capturas (ver el checklist) pero no en el juego real.
- [ ] **Los números de las herramientas** (×2, ×4, ×6 y ×8, y sus usos) salen de Minecraft y no están ajustados a este juego. Tampoco que la piedra necesite pico: es una decisión que cambia el ritmo del comienzo.
- [ ] **El aspecto y la sensación de la Fase 3:** los biomas, la oscuridad de las cuevas (`CONFIG.luzMinima`), las texturas de los minerales y el cactus, el agua que fluye y la cabaña. Se miraron en capturas, no en el juego real.
- [ ] **Cuánto cuesta en una PC modesta:** la generación de un chunk pasó a incluir cuevas (en la PC de las pruebas, ~0,8 ms por chunk) y las mallas calculan la luz del cielo. No se midió en una PC chica.
- [ ] **El aspecto y la sensación de los mobs:** cómo se ven y caminan el cerdo, la vaca y el zombi, el empujón y el destello rojo al golpearlos, cuánto cuesta matar a un zombi con la mano o con espada, y si 3 puntos por segundo es mucho. Se miraron solo en capturas (ver el checklist); los números salen de Minecraft.
- [ ] **Cuántas cuevas y minerales:** los números (4% de aire, 15 hierros y 1 diamante por chunk) son una primera estimación.

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
