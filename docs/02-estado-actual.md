# 02 · Estado actual

> Última revisión: 2026-11-19 · Corresponde al commit `e69a868` (versión 0.1.0).
> Esta lista sale de leer el código. **Nada de esto fue probado jugando durante la redacción**, así que ver "Pendientes de verificar" al final.

## Resumen

Un mundo de bloques infinito en horizontal (se genera alrededor del jugador) con ciclo de día y noche, agua, árboles, sombras, y un inventario con objetos que caen al suelo. Se puede explorar, romper y poner bloques. No hay objetivos, enemigos ni guardado.

Tamaño: unas 1.950 líneas en 11 archivos, más `package.json` y README.

## Cómo correrlo

```powershell
npm install   # solo la primera vez
npm start
```

F12 abre la consola de desarrollo. Desde la consola, `window.mc` expone el estado del juego (jugador, chunks, inventario, configuración) para experimentar.

## Qué funciona

### Mundo

| Función | Detalle |
|---|---|
| Terreno | Colinas y valles con ruido (fbm de 2 dimensiones), semilla fija `1337`. Alturas entre 20 y 52 bloques aproximadamente. |
| Tamaño | Infinito en X y Z. Altura fija de 64 bloques. |
| Chunks | Bloques de 16×64×16. Se generan y descargan según la distancia del jugador (6 chunks de radio en calidad media). |
| Capas | Césped arriba, 3 capas de tierra, piedra abajo. Arena en lugar de césped/tierra en la costa. |
| Agua | Lagos y mar hasta la altura 26. Translúcida y animada. No fluye. |
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

- **Guardado y carga de mundos.** Ver también la limitación importante más abajo.
- Crafteo, herramientas y durabilidad.
- Mobs, vida, hambre, daño de caída.
- Cuevas, minerales, biomas, estructuras.
- Multijugador.
- Sonido y música.
- Menú principal y menú de opciones (solo hay una pantalla de pausa con la lista de controles).
- Mods o extensiones.
- Instalador de Windows.
- Tests automáticos.

## Limitaciones conocidas (leídas del código)

1. **Los cambios al mundo se pierden al alejarte.** Los chunks lejanos se borran de la memoria y, al volver, se regeneran desde la semilla. Esto afecta a lo que construís aunque no cierres el juego. Es lo primero que habría que resolver antes del guardado y del multijugador.
2. **El agua no fluye.** Es solo relleno hasta el nivel del mar. Romper un bloque junto al agua no la deja entrar.
3. **El terreno es solo un mapa de alturas.** Por eso no hay cuevas ni salientes: cada columna tiene una única superficie.
4. **La generación de chunks corre en el hilo principal.** Hay un presupuesto por frame para no trabar, pero a mayor distancia de visión puede haber tirones.
5. **La capa más baja del mundo (y=0) no se puede romper**, y el fondo del mundo es sólido.
6. **No hay herramientas.** Todos los bloques tardan lo mismo en romperse sin importar lo que tengas en la mano.
7. **Solo Windows está contemplado.** No se probó en otros sistemas.

## Pendientes de verificar

**Max jugó poco el juego y no vio bugs hasta ahora**, pero eso no equivale a que no haya: no hubo una prueba sistemática. Tampoco se midió el rendimiento. Todo lo de este documento sale de leer el código.

- [ ] Una sesión de prueba: recorrer cada función de la lista de arriba y marcar cuál anda y cuál no. Se puede pedir a la IA que arme el checklist.
- [ ] Medir FPS en cada preset de calidad, en al menos una PC modesta (el requisito está en [01-vision.md](01-vision.md#requisito-de-rendimiento)).
- [ ] Anotar acá cualquier bug que aparezca, con fecha y cómo reproducirlo.

### Bugs conocidos

Ninguno registrado todavía.

### Rendimiento medido

Sin datos todavía. Tabla a completar:

| Fecha | PC (CPU / GPU / RAM) | Preset | FPS aprox. | Notas |
|---|---|---|---|---|
| — | — | — | — | — |
