# Sesión 2026-11-19 · Pruebas del juego

- **Dispositivo:** sin dato (completar).
- **Objetivo:** probar el juego, armar un checklist y dejar registrado el estado real (bugs y rendimiento) en lugar de lo que decía solo el código.
- **Prompt(s) clave:** *"Bueno, ahora vamos a empezar a avanzar"*, y elegir "Probar el juego y armar checklist" entre cuatro opciones que propuso la IA.
- **Resultado:** [06-checklist-pruebas.md](../06-checklist-pruebas.md) nuevo, y secciones de bugs y rendimiento completadas en [02-estado-actual.md](../02-estado-actual.md). Commit: *(pendiente)*.
- **Qué funcionó:**
  - Servir el juego en un navegador y manejarlo desde la consola con `window.mc` permitió probar casi todo sin intervención humana.
  - Medir en vez de suponer encontró dos cosas que la lectura del código no mostraba: el agua es poco profunda, y la resolución adaptativa se queda baja si los FPS están limitados.
  - Confirmar con datos la limitación del mundo que se pierde (una torre construida desapareció al volver).
- **Qué falló o hubo que corregir:**
  - Los FPS que reportó el navegador integrado no sirvieron: está limitado a ~30. Hubo que medir el costo por cuadro en su lugar. Un primer intento con `gl.finish()` dio números falsos (0.3 ms); se corrigió forzando la sincronización con una lectura de píxel.
  - Un par de pruebas mías apuntaron mal (rompí un bloque distinto al que pensaba). Se aclararon al revisar los datos.
- **Lección:** al pedirle a la IA que pruebe algo, conviene preguntar **qué no pudo comprobar y por qué**. Acá quedó explícito que faltan el mouse real, Electron y una PC modesta, en vez de dar todo por probado.
- **Quedó pendiente:**
  - [ ] Que Max juegue con `npm start` y complete las filas ⬜ del checklist (mouse, Esc, correr, noche).
  - [ ] Medir FPS en una PC modesta.
  - [ ] Decidir si se arregla el comportamiento de la resolución adaptativa (observación #1 de "Bugs conocidos").
  - [ ] Elegir la primera tarea del roadmap: Fase 0 (que el mundo conserve los cambios) sigue siendo la propuesta.
