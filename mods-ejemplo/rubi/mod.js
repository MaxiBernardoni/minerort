// Mod de ejemplo "Rubíes": usa casi toda la API (guía completa en docs/07-mods.md).
// Para probarlo: copiá la carpeta "rubi" a %APPDATA%\minicraft\mods\ (o tocá "Abrir carpeta de mods" en el menú) y abrí el juego.
export default function (api) {
  // Un objeto: el rubí. El dibujo es un sprite de 16x16 (una letra por pixel, '.' es transparente).
  const rubi = api.objeto('rubi', {
    nombre: 'Rubí',
    sprite: {
      filas: [
        '................', '................', '................', '.....oooooo.....', '....oRRwRRRo....', '...oRRRRRRRRo...',
        '..oRRRRRRRRRro..', '..oRRRRRRRRrro..', '...oRRRRRRrro...', '....oRRRRrro....', '.....oRRrro.....', '......orro......', '.......oo.......',
      ],
      paleta: { o: '#4a0814', R: '#e0284a', r: '#a8183a', w: '#ffb0c0' },
    },
  });

  // Un bloque: el mineral. Se rompe con un pico de hierro o mejor (nivel 2) y suelta el rubí.
  const mineral = api.bloque('mineral', {
    nombre: 'Mineral de rubí',
    textura: api.texturas.mineral([225, 40, 74]),
    dureza: 2.4, suelta: rubi, herramienta: 'pico', necesita: true, nivel: 2,
  });

  // Una herramienta: el pico de rubí, mejor que el de diamante. Se fabrica en la mesa de crafteo con 3 rubíes y 2 palos.
  const pico = api.objeto('pico', {
    nombre: 'Pico de rubí',
    sprite: { herramienta: 'pico', principal: '#d8284a', claro: '#ff9ab0' },
    herramienta: 'pico', velocidad: 12, usos: 1800, nivel: 3,
  });
  api.receta([[rubi, rubi, rubi], [0, api.ID.PALO, 0], [0, api.ID.PALO, 0]], [pico, 1]);

  // Generación: cada chunk nuevo puede tener una veta de rubíes entre y=3 y y=20 (siempre las mismas para la misma semilla).
  api.alGenerarChunk(ctx => {
    const azar = ctx.azar(1);                       // el número 1 distingue este uso del azar de otros
    if (azar() > 0.6) return;
    let x = Math.floor(azar() * 16), z = Math.floor(azar() * 16), y = 3 + Math.floor(azar() * 18);
    for (let i = 0; i < 3 + Math.floor(azar() * 3); i++) {
      ctx.colocar(x, y, z, mineral);                // solo reemplaza piedra
      const d = Math.floor(azar() * 6);
      if (d < 2) x += d ? 1 : -1; else if (d < 4) z += d === 3 ? 1 : -1; else y += d === 5 ? 1 : -1;
    }
  });

  // Un mob: una gelatina verde, pasiva, que a veces suelta un rubí.
  api.mob('gelatina', {
    nombre: 'Gelatina', forma: 'cuadrupedo', color: [0.35, 0.78, 0.4], color2: [0.25, 0.6, 0.3], escala: 0.8,
    vida: 8, vel: 1.4, pasivo: true, botin: [[rubi, 1, 1, 0.25]],
  });

  // Un evento: avisa cuando se rompe un mineral de rubí.
  api.on('bloque-roto', e => { if (e.id === mineral) api.toast('¡Un mineral de rubí!'); });
}
