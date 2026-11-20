# MiniCraft

Mi propia versión de Minecraft. Electron + Three.js, mundo generado por código, sin imágenes externas.

## Correr

```
npm install     # solo la primera vez
npm start
npm test        # pruebas automáticas (unos 30 segundos, sin mostrar ventana)
npm run captura # saca capturas del juego en capturas/ para revisar cómo se ve
```

## Controles

WASD mover · Espacio saltar (y nadar hacia arriba) · Shift correr · click izq. mantenido: romper (o pegarle a un mob) · click der.: poner (o comer una manzana, o abrir una mesa de crafteo) · 1-9 o rueda: elegir ranura · E: inventario · F volar · V primera/tercera persona · T avanzar la hora · G sombras · K calidad (alta/media/baja) · Esc pausa · F12 consola

## Inventario

- 36 espacios: barra rápida (1-9) + mochila. Los bloques que rompés caen al suelo y se recogen al acercarte; al poner uno se gasta.
- Pantalla (E): click agarra/suelta, click derecho mitad/uno, Shift+click mueve rápido, 1-9 sobre un espacio lo manda a la barra, click afuera lo tira.
- Modo creativo (botón dentro del inventario): catálogo de todos los bloques y objetos, con pestañas (Todo / Bloques / Objetos) y un buscador. No se gasta nada. `CONFIG.creative` lo deja activado desde el inicio.
- Césped suelta tierra, hojas sueltan a veces (ver `drop` en `src/config.js`). **La piedra, el adoquín y el ladrillo solo sueltan algo si los rompés con un pico.** El mineral de hierro pide pico de piedra y el de diamante pico de hierro.

## Crafteo y herramientas

- **Crafteo:** el inventario (E) tiene una grilla de 2×2; la **mesa de crafteo** (click derecho sobre ella) tiene una de 3×3. Poné los ingredientes y sacá el resultado (Shift+click: todo lo que se pueda). Las recetas no dependen de la posición ni del lado.
- **Recetas:** 1 madera → 4 tablones · 2 tablones uno sobre otro → 4 palos · 4 tablones en cuadrado → mesa de crafteo · pico, hacha y pala de tablones o de adoquín con palos (3×3 de la mesa).
- **Espadas:** de madera, piedra, hierro y diamante (2 material sobre 1 palo). Pegan 4, 5, 6 y 7 puntos (la mano, 1) y gastan un uso por golpe.
- **Herramientas:** el pico rompe más rápido piedra, adoquín, ladrillo y minerales; el hacha, madera, tablones y mesa; la pala, tierra, césped, arena y nieve. Madera ×2 (59 usos), piedra ×4 (131), hierro ×6 (250) y diamante ×8 (1561). Se desgastan (barrita en el inventario) y se rompen al agotarse. No se apilan.
- Las de hierro y diamante se fabrican con las mismas formas, con **lingotes de hierro** o **diamantes** en lugar de tablones.

## Mundo

- **Biomas:** llanura, bosque, desierto (arena y cactus) y nevado (nieve y pinos). Lo alto de las montañas es nieve.
- **Cuevas** bajo tierra, con pozos de entrada, oscuras (sin antorchas todavía), y vetas de **hierro** y **diamante** (el diamante solo abajo, hasta y=14).
- **Agua que fluye:** si rompés un bloque que contenía agua, entra; una fuente en el aire cae en cascada. Se seca sola al sacarle la fuente.
- **Cabañas** de tablones, raras, con una mesa de crafteo adentro.

## Mobs

- **Cerdos y vacas** pasean por el césped; al pegarles huyen y sueltan **carne** (click derecho: se come, restaura 6 de hambre).
- **Zombis** salen de noche, te persiguen y pegan 3 puntos por segundo (1,5 corazones). De día, si les da el sol, se queman. Un techo los protege.
- Se les pega con click izquierdo (a menos de 3,5 bloques). `CONFIG.mobs` los apaga y `CONFIG.maxMobs` limita cuántos hay.

## Salud (supervivencia)

- 10 corazones de vida y 10 muslos de hambre, sobre la barra rápida. En creativo no hay daño ni hambre.
- Caer más de 3 bloques duele (8 bloques = 5 puntos); al agua no. Correr, saltar, nadar y romper bloques dan hambre; caminar no.
- Con el hambre llena la vida se regenera. Sin comida el hambre llega a 0 y la vida baja hasta 1 corazón, pero no te morís de hambre.
- La **manzana** (a veces la sueltan las hojas) restaura hambre: click derecho con ella en la mano. Es un objeto plano, no un bloque.
- Al morir aparece el botón **Reaparecer**: conservás el inventario y volvés al punto de partida del mundo.
- `CONFIG.hambre` y `CONFIG.danoCaida` en `src/config.js` apagan el hambre y el daño por caída.

## Personaje

- Cuerpo con cabeza, torso, brazos y piernas que proyecta sombra; en primera persona es invisible pero su sombra se ve en el suelo.
- Brazo en primera persona que sostiene el bloque (con la mano vacía se ve solo el brazo).
- V cambia a tercera persona: se ve caminar, mirar y golpear.

## Gráficos y animaciones

- Texturas de 32x32 generadas por código (ruido tileable, ruido celular), hojas con huecos transparentes.
- Sombras reales del sol y la luna, más oscurecimiento en las esquinas (ambient occlusion).
- Ciclo de día y noche con sol, luna, estrellas, atardecer y niebla que cambia de color.
- Nubes que se desplazan, agua animada y translúcida, nadar, hojas que se mecen con el viento.
- Romper con grietas progresivas y partículas, bloque en la mano con balanceo, golpe y animación de sacar.
- Camara: balanceo al caminar, golpe al aterrizar, FOV más ancho al correr, niebla azul bajo el agua.

## Estructura (pensada para pedirle cambios a la IA archivo por archivo)

| Archivo | Qué contiene |
|---|---|
| `src/config.js` | Números ajustables (sombras, hora, velocidad) y la lista de bloques |
| `src/textures.js` | Texturas de los bloques, agua, grietas e iconos, dibujadas por código |
| `src/scene.js` | Renderer, cámaras y luces |
| `src/quality.js` | Presets de calidad (alta / media / baja), tecla K |
| `src/player.js` | Estado compartido del jugador y del mouse |
| `src/world.js` | Terreno, biomas, cuevas, minerales, árboles, cabañas, chunks y mallas 3D |
| `src/agua.js` | Agua que fluye |
| `src/fisica.js` | Choque de cajas contra los bloques (lo usan el jugador y los mobs) |
| `src/mobs.js` | Cerdos, vacas y zombis: modelos, IA, aparición y combate |
| `src/sky.js` | Cielo, sol/luna/estrellas, nubes y ciclo de día |
| `src/effects.js` | Partículas, grietas y el brazo/bloque en primera persona |
| `src/character.js` | Cuerpo del personaje, sombra y tercera persona |
| `src/inventory.js` | Inventario, barra rápida, pantalla de inventario y objetos caídos |
| `src/game.js` | Jugador, física, controles, interfaz y bucle principal |
| `src/salud.js` | Vida, hambre, daño por caída, muerte y la barra de corazones y muslos |
| `src/menu.js` | Menú principal: elegir, crear y borrar mundos |
| `src/guardado.js` | Qué se guarda de la partida, el mundo elegido y el autoguardado |
| `main.js` | Ventana de Electron y guardar al cerrar |
| `preload.js` | Puente entre el juego y Electron (solo `window.guardado`) |
| `guardado-main.js` | Lee y escribe los mundos (una carpeta por mundo) |
| `test/` | Las pruebas automáticas (`npm test`) y las capturas (`npm run captura`) |

## Rendimiento

- Calidad: tecla K cambia entre alta / media / baja (presets en `QUALITY`, `src/config.js`). Por defecto es media.
- Resolución adaptativa: si los FPS caen, el juego baja la resolución solo (y la sube cuando sobra). Se apaga con `adaptiveResolution: false`.
- Arriba a la izquierda se ve FPS, resolución, llamadas de dibujo y triángulos.
- Para más FPS: `antialias: false`, bajar `renderDistance` o usar calidad baja. Las sombras son lo más caro.

## Guardado

Al abrir el juego aparece el **menú principal**: elegís un mundo guardado (**Jugar**), lo borrás (**Borrar**, pide confirmar) o creás uno nuevo con nombre y semilla opcionales. Dentro de un mundo, Esc abre la pausa y **Guardar y volver al menú** te devuelve al menú.

Cada mundo se guarda solo cada 30 segundos, al cerrar la ventana y al volver al menú: cambios al mundo, inventario, modo, hora, posición, vida y hambre. Los mundos están en `%APPDATA%\minicraft\mundos\`, una carpeta por mundo. Si tenías una partida de la versión anterior, el menú la mueve sola a un mundo llamado "Mi mundo".

## Documentación

La carpeta [`docs/`](docs/README.md) explica el proyecto en detalle: [visión](docs/01-vision.md), [estado actual](docs/02-estado-actual.md), [arquitectura](docs/03-arquitectura.md), [roadmap](docs/04-roadmap.md) y [proceso de vibecoding](docs/05-proceso-vibecoding.md).

## Ideas para seguir

(Versión corta. El plan completo y ordenado está en [docs/04-roadmap.md](docs/04-roadmap.md).)

1. Antorchas y horno (para que las cuevas y el hierro tengan sentido completo), y más mobs.
2. Menú de opciones y más cosas en el menú de mundos (renombrar, duplicar, elegir el modo).
3. Armaduras y arcos.
4. Sonidos: pasos, romper, agua, ambiente.
5. Empaquetar como .exe con electron-builder.
