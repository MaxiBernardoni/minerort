# 07 · Cómo escribir un mod

> Última revisión: 2026-11-20 · Corresponde a la API **versión 1** (`apiVersion: 1`), la primera. El código está en `src/mods.js` (la API), `mods-main.js` (lista y valida las carpetas) y `src/eventos.js` (los avisos). Hay un mod de ejemplo completo en [`mods-ejemplo/rubi/`](../mods-ejemplo/rubi/).

Un mod suma bloques, objetos, recetas, mobs, minerales y reacciones a lo que pasa en el juego, **sin tocar el código del juego**. Es JavaScript (un módulo ES). No se necesita instalar nada ni compilar.

> **⚠ Un mod es código que corre dentro del juego.** No tiene `require` ni acceso directo a archivos, pero sí a todo lo que tiene la página (el DOM, la red) y al estado del juego. **Instalá solo mods de gente de confianza**, como cualquier programa. No hay aislamiento ni revisión.

## Dónde se instalan

En la carpeta de mods: **`%APPDATA%\minicraft\mods\`** (en el menú principal hay un botón **Abrir carpeta de mods**; la crea si no existe). Es la misma carpeta con el juego instalado y con `npm start`. Cada mod es **una carpeta** adentro. Para probar el de ejemplo, copiá `mods-ejemplo\rubi` ahí y abrí el juego.

Los mods se cargan **al abrir un mundo** (no en el menú). Para cambiar un mod hay que volver al menú y volver a entrar (o reiniciar el juego): cada entrada recarga la página y los vuelve a leer.

## La carpeta de un mod

```
rubi/
  mod.json    el manifiesto
  mod.js      el código (puede importar otros .js de la misma carpeta con rutas relativas)
```

`mod.json`:

```json
{
  "id": "rubi",
  "nombre": "Rubíes",
  "version": "1.0.0",
  "autor": "Tu nombre",
  "descripcion": "Qué hace",
  "apiVersion": 1,
  "main": "mod.js"
}
```

- **`id`** (obligatorio): letras minúsculas, números y guiones, hasta 30. Es el prefijo de todo lo que registra el mod (`rubi:mineral`) y tiene que ser único. **No lo cambies** una vez que alguien jugó con el mod: es cómo los mundos guardados lo reconocen.
- **`nombre`** (obligatorio) y `version`, `autor`, `descripcion` (se muestran en el menú).
- **`apiVersion`** (obligatorio): hoy `1`. Si el juego tiene otra, rechaza el mod con un mensaje claro en vez de cargarlo a medias.
- `main`: el archivo de entrada (por defecto `mod.js`); tiene que estar adentro de la carpeta del mod.

`mod.js` exporta **por defecto una función** que recibe `api`:

```js
export default function (api) {
  // acá se registra todo
}
```

Si el mod falla (error al cargar, manifiesto malo, `apiVersion` distinta), **se saltea y el resto del juego sigue**. El motivo se ve en la consola (F12, líneas `[mod tu-id] ...`) y, para los errores de manifiesto, también en el menú (en rojo); al entrar a un mundo, el juego avisa con un cartel "N mod(s) con errores". Los mods se cargan por orden alfabético de `id`.

## La API (`api`)

### Bloques: `api.bloque(nombre, definicion)` → id

```js
const mineral = api.bloque('mineral', {
  nombre: 'Mineral de rubí',
  textura: api.texturas.mineral([225, 40, 74]),   // o texturas: { arriba, abajo, lados }
  dureza: 2.4,              // segundos para romperlo a mano (la piedra: 1.1)
  suelta: rubi,             // qué suelta (un id o un nombre; por defecto, el mismo bloque)
  probabilidad: 1,          // con qué probabilidad lo suelta
  herramienta: 'pico',      // 'pico' | 'hacha' | 'pala': la que lo rompe más rápido
  necesita: true,           // solo suelta algo si se rompe con esa herramienta
  nivel: 2,                 // y de este material o mejor: 0 madera, 1 piedra, 2 hierro, 3 diamante
});
```

- El `nombre` (primer parámetro) identifica al bloque: letras minúsculas, números, `_` y `-`. El nombre para mostrar es `nombre` de la definición.
- **Texturas** (de 32×32 píxeles, dibujadas por código; **no se usan imágenes externas**): un color `[r, g, b]` (0–255) da un ruido de ese color; `{ color, variacion }` lo ajusta; `{ mineral: [r, g, b] }` es piedra con manchas; o una función `(x, y) => [r, g, b]` con `x` e `y` de 0 a 31. `api.texturas.ruido(color, variacion)` y `api.texturas.mineral(color)` devuelven esas funciones. Hay lugar para **43 texturas distintas** entre todos los mods.
- Todos los bloques de mods son **sólidos y opacos** (en la versión 1 no hay bloques transparentes ni que no se puedan atravesar).
- Aparecen solos en el **catálogo del modo creativo**.

### Objetos: `api.objeto(nombre, definicion)` → id

Lo que no se pone en el mundo: gemas, comida, herramientas.

```js
const pico = api.objeto('pico', {
  nombre: 'Pico de rubí',
  sprite: { herramienta: 'pico', principal: '#d8284a', claro: '#ff9ab0' },   // 'pico' | 'hacha' | 'pala' | 'espada'
  herramienta: 'pico', velocidad: 12, usos: 1800, nivel: 3,
});
const rubi = api.objeto('rubi', { nombre: 'Rubí', sprite: { filas: [/* 16 strings */], paleta: { o: '#4a0814', R: '#e0284a' } } });
const manzana = api.objeto('pan', { nombre: 'Pan', sprite: { ... }, comida: 5 });
```

- **`sprite`**: o `{ filas, paleta }` (hasta 16 filas de 16 caracteres; cada letra es un color de la paleta y `.` es transparente) o `{ herramienta, principal, claro }` para dibujar una herramienta con tus colores.
- `comida`: puntos de hambre que devuelve al comerlo (click derecho).
- `herramienta` (`'pico'`, `'hacha'`, `'pala'` o `'espada'`), `velocidad` (multiplicador), `usos` (cuántos bloques o golpes aguanta), `nivel` (ver arriba) y `danio` (espadas: puntos de vida que quita). Las herramientas no se apilan y se desgastan.

### Recetas: `api.receta(forma, [resultado, cantidad])`

```js
api.receta([[rubi, rubi, rubi], [0, api.ID.PALO, 0], [0, api.ID.PALO, 0]], [pico, 1]);
```

`forma` son filas de ids (`0` = vacío) de 1×1 hasta 3×3. Vale **en cualquier posición y espejada**, igual que las del juego (`api.ID.PALO`, `api.ID.TABLONES`, `api.ID.ADOQUIN`, `api.ID.LINGOTE`, `api.ID.DIAMANTE`… son los nombres del juego). Las de 2×2 se pueden hacer en el inventario; las más grandes, en la mesa de crafteo.

### Mobs: `api.mob(nombre, definicion)`

```js
api.mob('gelatina', {
  nombre: 'Gelatina', forma: 'cuadrupedo',          // 'cuadrupedo' | 'humanoide'
  color: [0.35, 0.78, 0.4], color2: [0.25, 0.6, 0.3], escala: 0.8,   // colores de 0 a 1; escala solo para cuadrúpedos
  vida: 8, vel: 1.4,
  pasivo: true,                                     // o hostil: true (con danio: puntos por golpe)
  botin: [[rubi, 1, 1, 0.25]],                      // [id, mínimo, máximo, probabilidad]
});
```

Tiene que ser **o pasivo o hostil**. Aparece solo con los del juego: los pasivos de día sobre césped, los hostiles de noche (persiguen y pegan; de día se queman).

### Generación: `api.alGenerarChunk(funcion)`

Se llama cada vez que se genera un chunk **nuevo** (los ya guardados no se tocan). Sirve para minerales y estructuras.

```js
api.alGenerarChunk(ctx => {
  const azar = ctx.azar(1);                    // genera números de 0 a 1; siempre la misma serie para el mismo chunk y semilla
  if (azar() > 0.6) return;
  ctx.colocar(x, y, z, mineral);               // x, z LOCALES al chunk (0 a 15); solo reemplaza piedra
});
```

`ctx` tiene: `cx`, `cz` (el chunk), `azar(sal)` (el número `sal` distingue usos distintos del azar), `colocar(lx, y, lz, id, solo = 3)` (`solo` es lo único que reemplaza; `null` = todo), `data` (los bloques, índice `y*256 + z*16 + x`), `heightAt(x, z)` y `biomeAt(x, z)` (con coordenadas de mundo), `hash2`, `semilla`, `CS` (16) y `H` (64). **Tiene que dar siempre el mismo resultado** para el mismo chunk (por eso `azar` y no `Math.random`): si no, los chunks vecinos no encajan y los mundos cambian al recargar.

### Eventos: `api.on(evento, funcion)`

| Evento | Datos | Cuándo |
|---|---|---|
| `inicio` | `{}` | el mundo ya está cargado, antes del primer cuadro |
| `cuadro` | `{ dt }` | cada cuadro (60 veces por segundo: **no hagas trabajo pesado**) |
| `bloque-roto` | `{ x, y, z, id }` | el jugador rompió un bloque (ya no está) |
| `bloque-puesto` | `{ x, y, z, id }` | el jugador puso un bloque |
| `mob-muerto` | `{ tipo, x, y, z, botin }` | murió un mob (`botin: false` si se quemó) |

Un oyente que **falla 5 veces se deja de llamar** (así un mod roto no llena la consola ni traba el juego).

### Otras cosas

- `api.mundo.getBlock(x, y, z)` y `api.mundo.setBlock(x, y, z, id)` leen y cambian el mundo (coordenadas de mundo; en un chunk sin cargar `getBlock` da aire y `setBlock` no hace nada).
- `api.id('rubi:rubi')` da el id de algo ya registrado (de tu mod o de uno cargado antes); `api.ID` tiene los nombres del juego.
- `api.toast('texto')` muestra un aviso en pantalla.
- `api.hash2(x, z, semilla)`, `api.CS`, `api.H`, `api.mod` (tu manifiesto), `api.version`.

Dónde se pueden usar nombres en vez de ids (`suelta`, `receta`, `botin`): un número, un nombre del juego (`'PALO'`) o `'mod:nombre'` de algo **ya registrado** (por eso se registra primero el rubí y después el mineral que lo suelta).

## Los ids y los mundos guardados

Cada bloque y objeto de un mod recibe un **id numérico** al cargarse (bloques del 30 al 99, objetos del 200 al 999). Como los mundos guardan ids, **la tabla `"mod:nombre" → id` se guarda en cada mundo**: aunque instales otro mod (que se carga antes) o cambies el orden, un mundo siempre ve los mismos ids.

- **Si un mod falta al abrir un mundo** (lo desinstalaste, o falló), el mundo carga igual: sus bloques y objetos quedan como **"desconocidos"** (damero magenta, o un signo de pregunta) **con el mismo id**. Se pueden romper, y si el mod vuelve, todo vuelve a ser lo que era. El juego avisa "Faltan mods de este mundo".
- **Renombrar o borrar un bloque u objeto de tu mod** (cambiar el `nombre`) lo hace otra cosa para los mundos viejos (el nombre viejo queda "desconocido"). No lo hagas en un mod que ya se repartió.
- **Cambiar la textura, la dureza, etc.** sí se puede cuando quieras.

## Límites de la versión 1

Lo que **no** se puede (todavía): bloques transparentes, que se atraviesen o con formas que no sean cubos; que un bloque haga algo al apretarlo con click derecho; modelos de mobs propios (solo `cuadrupedo` y `humanoide` con colores); comportamiento propio de mobs; biomas, árboles o estructuras nuevas con la generación (sí se pueden construir con `alGenerarChunk` y `colocar`, a mano); sonidos; cambiar cosas que ya existen del juego (solo se suman); interfaz propia; mods que dependan de otros (se cargan por orden alfabético, y no hay forma de declarar dependencias).

**Cada versión de la API que cambie algo existente sube `apiVersion`** y los mods viejos se rechazan con un mensaje claro hasta que se actualicen.

## Cómo probar un mod

1. Copiá la carpeta a `%APPDATA%\minicraft\mods\` y abrí un mundo (creá uno nuevo si querés ver la generación: un chunk ya generado y guardado no cambia).
2. **F12** abre la consola: ahí salen los errores del mod (`[mod tu-id] ...`).
3. En el modo creativo (botón dentro del inventario) está todo lo que registraste, con el buscador.
4. En la consola, `mc.mods.cargados()` dice qué se cargó y qué falló, y `mc.mods.estado()` muestra la tabla de ids.

Las pruebas automáticas del juego (`npm test`) cargan el mod de ejemplo, otros rotos a propósito, y verifican todo lo de este documento: léanse como ejemplos.
