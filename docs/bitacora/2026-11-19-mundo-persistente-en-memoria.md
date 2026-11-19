# Sesión 2026-11-19 · El mundo conserva los cambios (en memoria)

- **Dispositivo:** sin dato (completar).
- **Objetivo:** primera tarea de la Fase 0 del roadmap: que lo construido no se pierda al alejarse.
- **Prompt(s) clave:** *"Sigamos, después commiteás, no hay apuro."* La IA eligió la siguiente tarea del roadmap sin preguntar, porque ya estaba acordada como primera.
- **Resultado:** cambio de 3 líneas funcionales en `src/world.js` (`savedChunks`, marca `modified` y guardado al descargar). Probado: la torre y un hoyo sobreviven a ir a 15 chunks y volver, solo se guarda el chunk modificado y no hay errores. Commit: *(pendiente)*.
- **Qué funcionó:**
  - Tener la prueba que fallaba (la torre que desaparecía) permitió repetirla tal cual y ver el cambio de resultado.
  - Hacerlo mínimo: no se guarda nada en disco ni se toca el resto del código.
- **Qué falló o hubo que corregir:** la primera prueba dio "no se descargó el chunk" y parecía un bug del cambio. En realidad el panel del navegador estaba oculto y no corrían los cuadros. Hubo que mostrarlo y repetir.
- **Lección:** cuando una prueba da un resultado raro, **verificar primero el entorno** (¿corren los cuadros?) antes de sospechar del código.
- **Quedó pendiente:**
  - [ ] Guardado en disco (Fase 1): serializar `savedChunks` y los chunks cargados modificados, más la semilla y el inventario.
  - [ ] La memoria de `savedChunks` crece sin límite. Aceptable hasta tener guardado en disco.
  - [ ] El inventario y los objetos soltados tampoco se conservan al cerrar.
