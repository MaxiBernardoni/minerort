# Documentación de MiniCraft

Índice de la documentación. Cada documento responde una pregunta distinta:

| Documento | Responde |
|---|---|
| [01-vision.md](01-vision.md) | ¿Qué es el proyecto, por qué existe y cuáles son sus reglas? |
| [02-estado-actual.md](02-estado-actual.md) | ¿Qué funciona hoy y qué no existe todavía? |
| [03-arquitectura.md](03-arquitectura.md) | ¿Cómo está armado el código y cómo se conecta cada pieza? |
| [04-roadmap.md](04-roadmap.md) | ¿Qué se quiere construir y en qué orden? |
| [05-proceso-vibecoding.md](05-proceso-vibecoding.md) | ¿Cómo se trabaja con la IA y entre dispositivos? Reglas y plantillas. |
| [06-checklist-pruebas.md](06-checklist-pruebas.md) | ¿Qué se probó, qué anda y qué falta probar? |
| [07-mods.md](07-mods.md) | ¿Cómo se escribe un mod? La API, con un ejemplo. |
| [bitacora/](bitacora/) | ¿Qué se hizo en cada sesión? Un archivo por sesión, con prompts y lecciones. |

Además, [`CLAUDE.md`](../CLAUDE.md) en la raíz es lo que Claude Code lee solo al empezar cada sesión.

> **Se trabaja en varias sesiones y dispositivos.** Cada sesión de Claude Code es independiente, así que esta documentación y git son la memoria compartida. Reglas en [05-proceso-vibecoding.md](05-proceso-vibecoding.md#trabajo-en-varias-sesiones-y-dispositivos).

## Para quién está escrita

- **Para mí (Max), en el futuro:** para retomar el proyecto sin tener que releer todo el código.
- **Para una IA:** si le pasás estos documentos a Claude u otra IA al empezar una sesión, tiene el contexto necesario. Los más útiles para eso son `03-arquitectura.md` y `02-estado-actual.md`.
- **Para quien llegue al repo en GitHub:** `01-vision.md` explica el experimento y `02-estado-actual.md` muestra qué hay.

## Cómo mantener esta documentación al día

La documentación es parte del proyecto: si un cambio la deja desactualizada, se actualiza en el mismo commit.

- Se agregó o quitó una función → `02-estado-actual.md` y, si estaba prevista, `04-roadmap.md`.
- Cambió la estructura del código (archivos nuevos, orden de carga, datos) → `03-arquitectura.md`.
- Se hizo una sesión de trabajo con la IA → archivo nuevo en `bitacora/` (uno por sesión, nunca editar el de otra).

Cada documento indica al principio la fecha de su última revisión y el commit al que corresponde.
