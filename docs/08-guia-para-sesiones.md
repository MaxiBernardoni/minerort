# 08 · Guía para sesiones: leer, documentar y pensar etapas

> Última revisión: 2026-11-20 (después de los mods). Es para la IA que abre una sesión nueva sin memoria. Corta a propósito: cada sesión gasta contexto, y esto existe para ahorrarlo y para que todas pensemos igual. Lo que ya está en `CLAUDE.md` no se repite acá.

## 1. Cómo leer la documentación (gastando poco)

1. **`CLAUDE.md`** (se carga solo): reglas, comandos y trampas. Leelo entero, es corto.
2. **Última bitácora** (`docs/bitacora/`, la más nueva): **solo el campo "Quedó pendiente"** y las "Decisiones que tomó la IA". Es el traspaso.
3. **`docs/02-estado-actual.md`**: el resumen y la lista de **Limitaciones conocidas** (son lo que más evita errores). El resto, solo la sección que toques.
4. **`docs/03-arquitectura.md`**: el grafo de dependencias y la tabla de módulos al principio, y la tabla "Cómo pedirle cambios" casi al final (dice qué archivo toca cada tipo de cambio). El resto, solo la sección del archivo que vas a tocar.
5. **No leas de punta a punta**: `04-roadmap`, `05`, `06`, `07` y las bitácoras viejas se consultan con `Grep` por una palabra cuando hace falta.
6. **Antes de tocar un archivo, leelo** (o su sección con `offset`/`limit`). Los números de línea de los docs envejecen: confiá en el código.
7. **Los documentos pueden estar desactualizados.** Si un doc y el código no coinciden, manda el código; arreglá el doc.

## 2. Cómo escribir documentación

**Una cosa, un lugar.** Qué doc toca cada cambio:

| Cambió… | Se actualiza |
|---|---|
| Una función (nueva, quitada, distinta) | `02-estado-actual.md` y, si estaba en el plan, `04-roadmap.md` |
| La estructura del código (archivos, imports, datos) | `03-arquitectura.md` (grafo, tablas de módulos y de archivos, secciones, "puntos frágiles") |
| Cómo se corre, se prueba o se arma | `CLAUDE.md` y `README.md` |
| Cómo se escribe un mod | `07-mods.md` |
| Qué se probó o cómo se prueba | `06-checklist-pruebas.md` |
| La sesión | **un archivo nuevo** en `bitacora/` (plantilla en `05`); nunca editar la de otra sesión |

**Reglas de estilo (las que se aprendieron a las malas):**
- **Español rioplatense (voseo)**, directo, sin relleno. Comentarios del código en español y breves.
- **Solo hechos comprobados.** Cada número (pruebas, líneas, tamaños, porcentajes) sale de haberlo corrido o contado en esa sesión. Si no lo verificaste, escribí "sin verificar". **Dos veces se escribió en un doc algo que no era cierto** (que el menú mostraba errores de mods; que recortar three.js ahorraba mucho): se encontró releyendo el doc contra el código/la medición. Releé lo que escribís.
- **Decir lo que NO se hizo.** Cada fase termina con "Quedó pendiente" y con las **decisiones que tomó la IA donde nadie dijo nada** (para que Max las pueda cambiar).
- **Un nombre de prueba dice lo que prueba.** Si una prueba no hace lo que dice su nombre, renombrala.
- **Fechas absolutas** (`2026-11-20`), nunca "ayer". Cada doc empieza con su fecha de revisión y a qué corresponde.
- **Al agregar un límite o una trampa**, escribila en "Limitaciones conocidas" (02) o "Puntos frágiles" (03), no solo en la bitácora: es lo que lee la próxima sesión.
- **La bitácora lleva la lección**, una frase útil para otra sesión, y qué falló (sin adornos).
- **Cuidado al escribir archivos con la herramienta**: un `\`` (barra invertida antes de una comilla invertida) queda literal; después de crear un `.md`, buscá `\`` y arreglalo.

## 3. Cómo pensar las etapas

**Antes de empezar**
1. **Una función grande → preguntas primero** (2 a 4, con opciones y una recomendada). Cuánto trabajo evitás depende de lo que descartes ahí.
2. **Leé "Quedó pendiente" y el roadmap**: casi nunca hay que inventar la etapa, ya está planteada.
3. **Orden: lo compartido y lo que otros necesitan, primero; lo que depende de eso, después.** Ejemplos reales: la física de choque salió de `game.js` (`fisica.js`) *antes* de escribir mobs; las pruebas automáticas se hicieron *antes* de las funciones grandes, con el código chico; los mods registran ids guardados por mundo *antes* de escribir el mod de ejemplo.
4. **Lo irreversible o lo que cambia datos guardados se decide explícitamente** (ids guardados, formato del guardado, generación de terreno): anotá cómo se migra o qué costuras deja.

**Cómo se parte una etapa** (cada paso termina verde, `npm test`, antes del siguiente):
1. Refactor de lo compartido, **sin cambiar el comportamiento** (las pruebas existentes lo prueban solas).
2. El dato o el registro (config, `BLOCKS`, `ITEMS`, `TIPOS`…).
3. La lógica, como **funciones puras** cuando se puede (recetas, reglas de herramientas, `buscarReceta`): se prueban con tablas de casos.
4. La interfaz y lo visual.
5. Pruebas nuevas, **sabotaje**, capturas, docs, bitácora.

**Cómo se comprueba que anda** (todo esto se hizo en cada fase; no es opcional)
- **`npm test` antes de decir "listo".** Si algo falla, decí si es un bug del juego o de la prueba.
- **Sabotaje:** rompé el código a propósito en cada regla nueva y verificá que alguna prueba falle. Sin esto, hubo pruebas verdes que no probaban nada (una comparaba contra el mismo valor que se sabotea; un chequeo redundante nunca fallaba). Siempre con **copia del archivo y restaurar verificando con `cmp`**, y **sin romper la sintaxis en archivos del proceso principal** (`main.js`, `preload.js`, `guardado-main.js`, `mods-main.js`: muestra un diálogo de error en la pantalla de Max).
- **Mirar lo visual** (`npm run captura`, abrir los PNG): las pruebas no ven colores ni formas. Se encontraron así un zombi todo rojo, una carne que parecía manzana, cuevas casi negras.
- **Medir antes de ajustar** (un script chico que mida porcentajes, tiempos, conteos) y después ajustar los números.
- **Lo que no pudiste probar, decilo** (el mouse real, otra PC, rendimiento en una PC chica, el instalador con el asistente): va a "Pendientes de verificar".

**Reglas de conducta**
- **No commitees ni pushees sin que Max lo pida** (después de un commit pedido, el push es automático *salvo que diga que no*). No uses `--force`.
- **No toques los mundos reales de Max**: las pruebas usan carpetas temporales; el instalador silencioso y `npm start` abren los mundos reales.
- **Dependencias nuevas: avisá** (y decí por qué). **Nada de assets externos ni de Mojang.**
- **Cuando el usuario ya decidió, no re-preguntes.** Cuando algo es ambiguo y barato de cambiar, elegí, **anotalo como decisión** y seguí.
- **Poco contexto**: no releas lo ya leído, no pegues archivos largos en la respuesta, usá `Grep` y `offset`/`limit`, y cerrá cada fase con un resumen de pocas líneas.

## 4. Estado al 2026-11-20 (para ubicarse rápido)

Hechas las **Fases 0 a 5 y los mods de la 6** (92 pruebas). **Falta el multijugador**: ya decidido que va primero en **red local**, con un anfitrión y la dependencia `ws` (WebSocket) en el proceso principal; requiere separar el estado del mundo del dibujo y decidir qué hacer con los mods en red. **Es lo más grande del proyecto: preguntas primero.** Otros pendientes importantes: horno y antorchas, guardar los mobs, firmar el instalador, y que Max juegue y revise lo que solo se miró en capturas.
