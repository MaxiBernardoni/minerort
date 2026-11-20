# 01 · Visión del proyecto

> Última revisión: 2026-11-19 · Corresponde al commit `e69a868`.

## Qué es

**MiniCraft** es una versión propia de Minecraft, hecha como aplicación de escritorio (Electron + Three.js). El mundo, las texturas y los personajes se generan por código, sin imágenes ni modelos externos.

## Por qué existe

Es un **experimento de aprendizaje**. El objetivo no es solo tener un juego, sino **aprender a promptear con la práctica**: pedirle cosas a una IA, ver qué sale, corregir y registrar qué funciona.

El juego es el campo de práctica. Cada función nueva es una excusa para mejorar la forma de pedir.

## La regla del experimento

> **El proyecto es 100% vibecodeado: todo el código lo escribe la IA y yo no lo toco.**

Mi rol es:

1. Decidir qué quiero.
2. Pedirlo en lenguaje natural.
3. Probar el resultado en el juego.
4. Corregir con nuevos prompts.

Qué implica esta regla:

- No se edita código a mano, ni siquiera valores sueltos. Si hay que cambiar un número, se le pide a la IA.
- Los errores y malentendidos de la IA son material del experimento, no fallas a esconder: se anotan en [05-proceso-vibecoding.md](05-proceso-vibecoding.md).
- La documentación también la escribe la IA a partir de preguntas y respuestas conmigo.

> Nota: el README original sugiere que `src/config.js` es "la forma más fácil de experimentar" tocando números. Con esta regla, esos cambios también se piden por prompt.

## Herramientas

- **IA:** solo Claude Code (app de escritorio). No se usan otros modelos ni chats externos.
- **Motor:** Electron 33 y Three.js 0.149 (módulos ES con import map, sin bundler).
- **Plataforma objetivo:** Windows.

## Meta final

**Llegar lo más cerca posible de Minecraft**, sin un techo definido. Es un proyecto largo que crece por funciones. Las funciones deseadas hasta hoy están en [04-roadmap.md](04-roadmap.md).

Forma de distribución prevista: **instalador de Windows (.exe)**, para poder pasárselo a otras personas. Ya existe: `npm run empaquetar` lo arma (ver [02-estado-actual.md](02-estado-actual.md#instalador-de-windows)). Sin firmar, así que Windows avisa al abrirlo.

## Requisito de rendimiento

**El juego tiene que correr bien en cualquier PC**, no solo en una potente. Es un requisito permanente, no una función más: cada función nueva (mobs, cuevas, multijugador) debe evaluarse también por lo que cuesta en FPS.

Hoy esto se cubre con los presets de calidad y la resolución adaptativa (ver [02-estado-actual.md](02-estado-actual.md)). Falta definir qué es "una PC modesta" en números (por ejemplo, 30 FPS en una notebook con gráficos integrados); sin eso no se puede medir si se cumple.

## Mods hechos por otras personas

Los mods están previstos para que los **hagan otras personas**, no solo Max con la IA. Eso cambia lo que hay que construir: una forma documentada y estable de crear mods, y pensar en la seguridad de ejecutar código ajeno. Detalle en [04-roadmap.md](04-roadmap.md).

## Se trabaja en varias sesiones y dispositivos

El proyecto se desarrolla en **muchas sesiones de Claude Code, en varios dispositivos**, y cada sesión es independiente: no comparte memoria con las otras. El único hilo común es el repositorio. Por eso:

- La documentación es la memoria compartida del proyecto.
- Existe un `CLAUDE.md` en la raíz, que Claude Code lee solo al empezar cada sesión.
- Hay reglas de sincronización con git (ver [05-proceso-vibecoding.md](05-proceso-vibecoding.md#trabajo-en-varias-sesiones-y-dispositivos)).

## Qué NO es (por ahora)

- No es compatible con el Minecraft original: no lee sus mundos, texturas ni mods.
- No usa assets, código ni marca de Mojang o Microsoft. Todo es original y generado por código.
- No tiene fines comerciales.
- No busca igualar el motor original en tamaño de mundo ni en gráficos: la prioridad es aprender y avanzar, y que corra bien en máquinas modestas (ver "Requisito de rendimiento").

## Aviso legal

MiniCraft es un proyecto personal y educativo. **No está afiliado, asociado ni respaldado por Mojang Studios ni Microsoft.** "Minecraft" es una marca de sus respectivos dueños y se menciona solo como inspiración.

## Criterio de éxito

No hay una fecha ni un hito fijo. Se considera que el experimento va bien si:

- Cada función nueva se logra con pocos prompts, y se puede explicar por qué funcionó.
- El código sigue siendo ordenado y entendible para la IA en la sesión siguiente.
- La documentación alcanza para retomar el proyecto sin releer todo.

> **Pendiente de confirmar con Max:** si querés métricas concretas (por ejemplo, cantidad de prompts por función) además de este criterio cualitativo.
