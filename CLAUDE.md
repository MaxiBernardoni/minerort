# MiniCraft: instrucciones para la IA

Clon de Minecraft en Electron + Three.js, hecho como experimento de aprendizaje de prompting. Hablale a Max en español (voseo).

## Reglas

- **Vos escribís todo el código.** Max no edita a mano. Si hay que cambiar un número, lo cambiás vos.
- **Esta sesión es independiente.** Se trabaja desde varios dispositivos y no recordás sesiones anteriores. Lo único compartido es el repositorio: leé la documentación antes de tocar nada.
- **Rendimiento:** el juego debe correr bien en cualquier PC. Antes de sumar algo que cueste por frame, pensá en los FPS.
- **No uses assets, nombres ni código de Mojang o Microsoft.** Todo es original y generado por código.

## Al empezar la sesión

1. Corré `git pull` (preguntale a Max si hay dudas sobre ramas). Sin esto se trabaja sobre una versión vieja.
2. Leé [docs/README.md](docs/README.md), [docs/02-estado-actual.md](docs/02-estado-actual.md) y [docs/03-arquitectura.md](docs/03-arquitectura.md).
3. Leé las últimas 2 o 3 entradas de [docs/bitacora/](docs/bitacora/), en especial el campo **Quedó pendiente**.
4. Preguntale a Max qué quiere hacer. Si es una función grande, hacé preguntas antes de escribir código.

## Al terminar la sesión

1. Actualizá la documentación que el cambio dejó desactualizada:
   - función nueva o quitada → `docs/02-estado-actual.md` y `docs/04-roadmap.md`
   - estructura del código, orden de scripts o datos → `docs/03-arquitectura.md`
2. Creá `docs/bitacora/AAAA-MM-DD-tema.md` con la plantilla de [docs/05-proceso-vibecoding.md](docs/05-proceso-vibecoding.md). Es un archivo nuevo por sesión: **no edites la bitácora de otras sesiones** (evita conflictos entre dispositivos). Llená el campo **Quedó pendiente**.
3. Hacé commit cuando Max lo pida. **Después de cada commit hacé `git push` sin preguntar** (Max lo autorizó el 2026-11-19): sin eso, la sesión siguiente en otro dispositivo no ve nada. Solo push normal a `main`: nunca `--force` ni borrar ramas sin que lo pida.

## Cómo correr

```
npm install    # solo la primera vez
npm start
```

F12 abre la consola. `window.mc` expone el estado del juego.

## Convenciones del código

- **Módulos ES, sin bundler.** Cada archivo de `src/` importa lo que usa (`import`) y exporta lo que otros necesitan en un `export { … }` al final. `game.js` es la entrada (`index.html` solo carga ese). No hay globales: `THREE` se importa con `import * as THREE from 'three'`.
- **Sin dependencias circulares.** Un archivo importa solo de los "más abajo" en el grafo de [docs/03-arquitectura.md](docs/03-arquitectura.md#grafo-de-dependencias). Un módulo no puede reasignar lo que importa: usá un objeto (`shadow.dirty`) o una función.
- **`three` está fijado en 0.149.0** (se importa `three.module.js` con un import map en `index.html`). No lo actualices por tu cuenta: desde r155 cambia la iluminación y hay que revisarlo mirando el juego.
- Un archivo por responsabilidad (mapa en [docs/03-arquitectura.md](docs/03-arquitectura.md)). Un archivo nuevo se usa agregando el `import` donde se necesite; no hay que tocar `index.html`.
- Los valores ajustables van en `src/config.js`. Los bloques están definidos por datos en `BLOCKS`.
- Comentarios en español, breves. No agregues dependencias nuevas sin preguntarle a Max.
- Texturas y modelos se dibujan por código; no se agregan imágenes externas.

## Limitaciones conocidas que afectan a cualquier cambio

- Los cambios al mundo se conservan en memoria (`savedChunks` en `world.js`) pero **se pierden al cerrar el juego**: no hay guardado en disco.
- Para probar en el navegador integrado, el panel tiene que estar visible; si está oculto no corren los cuadros.
- La generación de chunks corre en el hilo principal.
- No hay tests: la verificación es jugar. Si no podés probarlo en el juego, decilo en vez de afirmar que anda.
