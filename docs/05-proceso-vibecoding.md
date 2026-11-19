# 05 · Proceso de vibecoding

> Última revisión: 2026-11-19. Este documento tiene las **reglas y plantillas**. El registro de cada sesión vive en la carpeta [`bitacora/`](bitacora/), un archivo por sesión.

El objetivo de MiniCraft es **aprender a promptear con la práctica** (ver [01-vision.md](01-vision.md)). Este documento guarda lo que se aprende, para no depender de la memoria.

## Reglas del experimento

1. **Todo el código lo escribe la IA.** Max no edita archivos a mano.
2. **Herramienta única:** Claude Code.
3. **Se registra el proceso desde el 2026-11-19.** La versión inicial se hizo antes de que hubiera registro; Max subirá el material de esa etapa (ver [bitacora/000-version-inicial.md](bitacora/000-version-inicial.md)).
4. **Los errores se anotan.** Un prompt que salió mal es tan útil como uno que salió bien.
5. **Los commits los hace la IA con su firma**, como ya figura en el historial (`Co-Authored-By`).

## Trabajo en varias sesiones y dispositivos

El proyecto se hace en **muchas sesiones de Claude Code, en varios dispositivos**. Cada sesión es independiente: no recuerda las anteriores ni comparte nada con las de otro dispositivo. Lo único compartido es el repositorio. Por eso la documentación y git son la memoria del proyecto.

### Al empezar una sesión

1. **Traer lo último:** `git pull`. Si no, la sesión trabaja sobre una versión vieja y después hay conflictos.
2. **La IA lee el contexto.** `CLAUDE.md` en la raíz se carga solo y le indica qué leer: [docs/README.md](README.md), [02-estado-actual.md](02-estado-actual.md), [03-arquitectura.md](03-arquitectura.md) y las últimas entradas de la bitácora.
3. Max dice qué quiere hacer en la sesión.

### Al terminar una sesión

1. **La IA actualiza la documentación** que el cambio dejó desactualizada (ver [README](README.md#cómo-mantener-esta-documentación-al-día)).
2. **La IA crea el archivo de bitácora** de la sesión.
3. **Commit** con los cambios de código y de documentación.
4. **`git push`.** Sin esto, la próxima sesión en otro dispositivo no ve nada. La IA recuerda hacerlo, pero el push lo autoriza Max.

### Reglas para evitar conflictos entre dispositivos

- **Una sesión por vez.** No trabajar en dos dispositivos a la vez sobre el mismo archivo.
- **Un archivo de bitácora por sesión**, nunca un archivo común al que todos le agregan. Así dos sesiones nunca editan el mismo archivo de registro.
- **Nunca editar la bitácora de otra sesión**, salvo para completar datos pendientes.
- **Si aparece un conflicto de git,** que la IA lo resuelva leyendo ambos lados, no eligiendo uno a ciegas.

> Estado de la sincronización al 2026-11-19: `main` está publicado en GitHub (`origin`). En otro dispositivo, clonar el repo y correr `npm install`. El repositorio está en `https://github.com/MaxiBernardoni/minerort.git`.

## Cómo registrar una sesión

Crear `docs/bitacora/AAAA-MM-DD-tema-corto.md` con esta plantilla. No hace falta que sea larga.

```markdown
# Sesión AAAA-MM-DD · <título corto>

- **Dispositivo:** (por ejemplo, "PC de casa", "notebook")
- **Objetivo:** qué quería lograr.
- **Prompt(s) clave:** el texto exacto, o un resumen fiel si fue muy largo.
- **Resultado:** qué pasó (funcionó / a medias / falló). Commit: `abc1234`.
- **Qué funcionó:** qué del prompt ayudó.
- **Qué falló o hubo que corregir:** y cuántos prompts extra hizo falta.
- **Lección:** una frase que valga la pena recordar.
- **Quedó pendiente:** qué debe retomar la próxima sesión.
```

El campo **Quedó pendiente** es el más importante para trabajar en varios dispositivos: es el traspaso de una sesión a la siguiente.

## Plantilla sugerida para pedir una función

Basada en cómo está estructurado el proyecto (un archivo por responsabilidad). Es una **hipótesis a probar**, no una receta comprobada: la idea es medir si ayuda y ajustarla.

```
Quiero: <qué debe pasar en el juego, visto desde el jugador>.
Contexto: <qué hay hoy relacionado; si hace falta, qué archivo>.
Restricciones: <no romper X; mantener el estilo del código; sin dependencias nuevas>.
Cómo lo voy a probar: <qué voy a hacer en el juego para ver que anda>.
```

Cosas que conviene incluir según lo que mostró el análisis del código:

- **Decir qué archivo corresponde** (tabla en [03-arquitectura.md](03-arquitectura.md#cómo-pedirle-cambios-a-la-ia-con-esta-estructura)): reduce el riesgo de que la IA toque lugares de más.
- **Pedir una función por vez.** El código es global y compartido; cambios grandes aumentan el riesgo de pisar algo.
- **Mencionar las limitaciones conocidas** si la función las toca (por ejemplo, que el mundo no persiste).
- **Mencionar el requisito de rendimiento** cuando la función suma trabajo por frame.

## Estrategias de trabajo para probar

Ideas para convertir el experimento en aprendizaje comparable. Ninguna está aplicada todavía.

- Pedir la **misma función de dos formas distintas** (muy abierta vs. muy detallada) y comparar cuántos prompts hizo falta corregir.
- Pedir que la IA **haga preguntas antes de empezar** (como pasó en la sesión de documentación) y ver si evita malentendidos.
- Anotar en cada sesión **cuántos prompts se necesitaron** hasta llegar al resultado que Max quería.
- Probar si un `CLAUDE.md` mejor escrito reduce las explicaciones repetidas al empezar cada sesión.

## Bitácora

Ver la carpeta [`bitacora/`](bitacora/). Sesiones registradas hasta ahora:

- [000 · Versión inicial](bitacora/000-version-inicial.md) (material pendiente de subir)
- [2026-11-19 · Documentación del proyecto](bitacora/2026-11-19-documentacion.md)
- [2026-11-19 · Pruebas del juego](bitacora/2026-11-19-pruebas-del-juego.md)
- [2026-11-19 · El mundo conserva los cambios (en memoria)](bitacora/2026-11-19-mundo-persistente-en-memoria.md)
- [2026-11-19 · Migración a módulos ES](bitacora/2026-11-19-modulos-es.md)
