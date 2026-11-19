# MiniCraft

Mi propia versión de Minecraft. Electron + Three.js, mundo generado por código, sin imágenes externas.

## Correr

```
npm install     # solo la primera vez
npm start
```

## Controles

WASD mover · Espacio saltar (y nadar hacia arriba) · Shift correr · click izq. mantenido: romper · click der.: poner · 1-9 o rueda: elegir ranura · E: inventario · F volar · V primera/tercera persona · T avanzar la hora · G sombras · K calidad (alta/media/baja) · Esc pausa · F12 consola

## Inventario

- 36 espacios: barra rápida (1-9) + mochila. Los bloques que rompés caen al suelo y se recogen al acercarte; al poner uno se gasta.
- Pantalla (E): click agarra/suelta, click derecho mitad/uno, Shift+click mueve rápido, 1-9 sobre un espacio lo manda a la barra, click afuera lo tira.
- Modo creativo (botón dentro del inventario): catálogo de todos los bloques y no se gasta nada. `CONFIG.creative` lo deja activado desde el inicio.
- Piedra suelta adoquín, césped suelta tierra, hojas sueltan a veces (ver `drop` en `src/config.js`).

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
| `src/world.js` | Terreno, agua, árboles, chunks y mallas 3D |
| `src/sky.js` | Cielo, sol/luna/estrellas, nubes y ciclo de día |
| `src/effects.js` | Partículas, grietas y el brazo/bloque en primera persona |
| `src/character.js` | Cuerpo del personaje, sombra y tercera persona |
| `src/inventory.js` | Inventario, barra rápida, pantalla de inventario y objetos caídos |
| `src/game.js` | Jugador, física, controles, interfaz y bucle principal |
| `main.js` | Ventana de Electron |

## Rendimiento

- Calidad: tecla K cambia entre alta / media / baja (presets en `QUALITY`, `src/config.js`). Por defecto es media.
- Resolución adaptativa: si los FPS caen, el juego baja la resolución solo (y la sube cuando sobra). Se apaga con `adaptiveResolution: false`.
- Arriba a la izquierda se ve FPS, resolución, llamadas de dibujo y triángulos.
- Para más FPS: `antialias: false`, bajar `renderDistance` o usar calidad baja. Las sombras son lo más caro.

## Ideas para seguir

1. Cuevas con ruido 3D y minerales.
2. Guardar y cargar el mundo (los bloques que rompiste/pusiste).
3. Crafteo (madera → tablones, palos, herramientas).
4. Mobs simples que caminen (animación con partes del cuerpo).
5. Sonidos: pasos, romper, agua, ambiente.
6. Empaquetar como .exe con electron-builder.
