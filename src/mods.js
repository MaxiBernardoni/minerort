// ============================================================
// mods.js - Carga de mods y la API que reciben (guia completa para quien escribe un mod: docs/07-mods.md).
//
// Un mod es una carpeta dentro de la carpeta de mods (en Windows: %APPDATA%\minicraft\mods\) con:
//   mod.json   { "id": "rubi", "nombre": "...", "version": "1.0.0", "autor": "...", "descripcion": "...", "apiVersion": 1, "main": "mod.js" }
//   mod.js     un modulo ES que exporta por defecto una funcion: export default function (api) { ... }
// El proceso principal (mods-main.js) lista las carpetas y valida los manifiestos; aca se importa cada mod y se le da `api`.
//
// ESTE CODIGO SE CONFIA EN LOS MODS: un mod corre dentro del juego con los mismos permisos que el juego (en la pagina, no en Node:
// no tiene require ni acceso directo a archivos, pero si a todo el DOM y a la red). Solo hay que instalar mods de gente de confianza.
//
// Los ids de bloques y objetos de los mods se ASIGNAN por nombre ("rubi:mineral") y la tabla se guarda en cada mundo
// (estado.mods): asi un mundo siempre vuelve a ver los mismos ids aunque cambie el orden o la cantidad de mods.
// Si un mod falta al abrir un mundo, sus bloques y objetos quedan como "desconocidos" (con su id) en vez de romper el mundo.
// ============================================================
import { ID, CS, H, BLOCKS, ITEMS, ITEM_IDS } from './config.js';
import { RECETAS } from './objetos.js';
import {
  hash2, tileNuevo, TILE_DESCONOCIDO, texturaRuido, texturaMineral, paintSprite, spriteDesconocido, herramientaSprite,
} from './textures.js';
import { actualizarTablas, registrarGancho, getBlock, setBlock } from './world.js';
import { registrarTipo } from './mobs.js';
import { agregarAlCatalogo, toast } from './inventory.js';
import { on } from './eventos.js';

const API_VERSION = 1;
const NOMBRE_VALIDO = /^[a-z0-9_-]{1,30}$/;
const RANGO = { bloques: [30, 99], objetos: [200, 999] };          // ids que usan los mods (los del juego estan por debajo)

const tabla = { bloques: {}, objetos: {} };                         // "mod:nombre" -> id (se guarda en el mundo)
const registrados = { bloques: new Set(), objetos: new Set() };     // lo que SI se registro en esta sesion
const cargados = [], fallidos = [];

function asignar(tipo, clave) {
  const [min, max] = RANGO[tipo], mapa = tabla[tipo], registro = tipo === 'bloques' ? BLOCKS : ITEMS;
  if (registrados[tipo].has(clave)) throw new Error(`"${clave}" ya esta registrado`);
  let id = mapa[clave];
  if (id === undefined) {                                           // nuevo: el primer id libre del rango
    const usados = new Set(Object.values(mapa));
    for (id = min; id <= max && (usados.has(id) || registro[id]); id++);
    if (id > max) throw new Error(`no quedan ids libres para ${tipo} de mods (rango ${min}-${max})`);
    mapa[clave] = id;
  } else if (registro[id]) {
    throw new Error(`el id ${id} de "${clave}" (guardado en este mundo) ya lo usa otra cosa`);
  }
  registrados[tipo].add(clave);
  return id;
}

// Un id (numero), un nombre del juego ('PALO') o un nombre de mod ('rubi:rubi')
function resolver(x) {
  if (typeof x === 'number') return x;
  if (typeof x === 'string') {
    if (x.includes(':')) {
      const id = tabla.objetos[x] ?? tabla.bloques[x];
      if (id === undefined) throw new Error(`"${x}" no existe (¿el mod que lo define se carga antes?)`);
      return id;
    }
    if (ID[x] !== undefined) return ID[x];
  }
  throw new Error('no se puede interpretar como bloque u objeto: ' + JSON.stringify(x));
}

const aTile = spec => {                                              // una textura: [r, g, b] | { color, variacion } | { mineral: [r, g, b] } | funcion (x, y) -> [r, g, b]
  if (typeof spec === 'function') return tileNuevo(spec);
  if (Array.isArray(spec)) return tileNuevo(texturaRuido(spec));
  if (spec && spec.mineral) return tileNuevo(texturaMineral(spec.mineral));
  if (spec && spec.color) return tileNuevo(texturaRuido(spec.color, spec.variacion));
  throw new Error('textura invalida (usa [r,g,b], { color }, { mineral } o una funcion (x, y) => [r,g,b])');
};

function crearApi(manifest) {
  const mod = manifest.id, prefijo = mod + ':';
  const nombre = n => { if (typeof n !== 'string' || !NOMBRE_VALIDO.test(n)) throw new Error(`nombre invalido "${n}": solo letras minusculas, numeros, _ y - (hasta 30)`); return prefijo + n; };
  const api = {
    version: API_VERSION, mod: manifest,
    ID: { ...ID }, CS, H, hash2,
    texturas: { ruido: texturaRuido, mineral: texturaMineral },
    mundo: { getBlock, setBlock },
    toast,

    // Un bloque nuevo. Devuelve su id.
    //   nombre: 'Mineral de rubi' · textura | texturas: { arriba, abajo, lados } · dureza (segundos a mano) · suelta (id o nombre) · probabilidad
    //   herramienta: 'pico' | 'hacha' | 'pala' · necesita: true (solo suelta con esa herramienta) · nivel (0 madera, 1 piedra, 2 hierro, 3 diamante)
    bloque(nom, def = {}) {
      const clave = nombre(nom), id = asignar('bloques', clave);
      const t = def.texturas || { arriba: def.textura, abajo: def.textura, lados: def.textura };
      if (!t.arriba && !t.lados) throw new Error(`el bloque "${nom}" necesita una textura`);
      const arriba = aTile(t.arriba || t.lados), lados = t.lados ? (t.lados === t.arriba ? arriba : aTile(t.lados)) : arriba;
      const abajo = t.abajo ? (t.abajo === t.arriba ? arriba : t.abajo === t.lados ? lados : aTile(t.abajo)) : arriba;
      BLOCKS[id] = {
        name: def.nombre || nom, tiles: [arriba, abajo, lados], hardness: def.dureza ?? 1, mod,
        ...(def.suelta !== undefined && { drop: resolver(def.suelta) }), ...(def.probabilidad !== undefined && { dropChance: def.probabilidad }),
        ...(def.herramienta && { herramienta: def.herramienta }), ...(def.necesita && { necesita: true }), ...(def.nivel && { nivel: def.nivel }),
      };
      ITEM_IDS.push(id); agregarAlCatalogo(id);
      return id;
    },

    // Un objeto nuevo (no se pone en el mundo). Devuelve su id.
    //   nombre · sprite: { filas: ['....', ...], paleta: { a: '#rrggbb' } } | { herramienta: 'pico'|'hacha'|'pala'|'espada', principal: '#rrggbb', claro: '#rrggbb' }
    //   comida (puntos de hambre) · herramienta ('pico'|'hacha'|'pala'|'espada') · velocidad · usos · nivel · danio (espadas)
    objeto(nom, def = {}) {
      const clave = nombre(nom), id = asignar('objetos', clave);
      const s = def.sprite;
      if (!s) throw new Error(`el objeto "${nom}" necesita un sprite`);
      if (s.filas) paintSprite(id, s.filas, s.paleta || {});
      else if (s.herramienta) herramientaSprite(id, s.herramienta, { principal: s.principal || '#aaaaaa', claro: s.claro || '#eeeeee' });
      else throw new Error('sprite invalido (usa { filas, paleta } o { herramienta, principal, claro })');
      ITEMS[id] = {
        name: def.nombre || nom, mod,
        ...(def.comida && { food: def.comida }),
        ...(def.herramienta && { tool: def.herramienta, velocidad: def.velocidad || 1, dur: def.usos || 100, nivel: def.nivel || 0, agarre: def.herramienta === 'espada' ? [2, 13] : [4, 11] }),
        ...(def.danio && { danio: def.danio }),
      };
      ITEM_IDS.push(id); agregarAlCatalogo(id);
      return id;
    },

    // Una receta de forma (como las del juego: en cualquier posicion y espejada). forma: filas de ids (0 = vacio), da: [id, cantidad]
    receta(forma, da) {
      if (!Array.isArray(forma) || !forma.length || forma.length > 3 || forma.some(f => !Array.isArray(f) || f.length !== forma[0].length || f.length > 3 || !f.length))
        throw new Error('la receta tiene que ser de 1x1 a 3x3 (filas del mismo largo)');
      const f = forma.map(fila => fila.map(c => (c === 0 ? 0 : resolver(c))));
      RECETAS.push({ forma: f, da: [resolver(da[0]), da[1] || 1] });
    },

    // Un mob nuevo: { nombre, forma: 'cuadrupedo' | 'humanoide', color: [r,g,b] (0..1), color2, escala, vida, vel, pasivo | hostil, danio, botin: [[id, min, max, probabilidad]] }
    // Aparece solo, como los del juego (los pasivos de dia sobre cesped, los hostiles de noche).
    mob(nom, def = {}) {
      const clave = nombre(nom);
      registrarTipo(clave, { ...def, botin: (def.botin || []).map(([id, min, max, prob]) => [resolver(id), min, max, prob]) });
      return clave;
    },

    // Se llama cada vez que se genera un chunk nuevo (nunca con uno guardado): para agregar minerales y estructuras.
    // ctx: { cx, cz, azar(sal), colocar(lx, y, lz, id, solo = 3), data, heightAt(x, z), biomeAt(x, z), hash2, semilla }
    alGenerarChunk(funcion) {
      let errores = 0;
      registrarGancho(ctx => {
        if (errores >= 5) return;
        try { funcion(ctx); } catch (e) { console.error(`[mod ${mod}] error al generar el chunk ${ctx.cx},${ctx.cz} (${++errores}/5):`, e); }
      });
    },

    // Escuchar un evento del juego (ver eventos.js): inicio, cuadro, bloque-roto, bloque-puesto, mob-muerto
    on(evento, funcion) { on(evento, funcion, mod); },

    // El id de algo ya registrado ('rubi:rubi', o de otro mod cargado antes)
    id: resolver,
  };
  return api;
}

// Carga todos los mods. `guardada` es la tabla de ids de este mundo (estado.mods.tabla), o null en un mundo nuevo.
// Un mod que falla no frena a los demas ni al juego.
async function cargarMods(guardada) {
  tabla.bloques = { ...(guardada && guardada.bloques) };
  tabla.objetos = { ...(guardada && guardada.objetos) };
  let lista = [];
  if (window.mods) { try { lista = await window.mods.listar(); } catch (e) { console.error('[mods] no se pudo leer la carpeta de mods:', e); } }
  for (const m of lista) {
    if (m.error) { fallidos.push({ id: m.id, error: m.error }); console.error(`[mods] ${m.carpeta}: ${m.error}`); continue; }
    try {
      const modulo = await import(m.url);
      const iniciar = modulo.default || modulo.iniciar;
      if (typeof iniciar !== 'function') throw new Error('el mod tiene que exportar por defecto una funcion: export default function (api) { ... }');
      await iniciar(crearApi(m.manifest));
      cargados.push({ id: m.manifest.id, nombre: m.manifest.nombre, version: m.manifest.version });
    } catch (e) {
      fallidos.push({ id: m.id, error: e.message });
      console.error(`[mod ${m.id}] no se pudo cargar:`, e);
    }
  }
  // Lo que este mundo tenia de un mod que ya no esta: marcadores, para que el mundo cargue y el id se conserve
  const faltan = new Set();
  for (const [clave, id] of Object.entries(tabla.bloques)) {
    if (registrados.bloques.has(clave) || BLOCKS[id]) continue;
    BLOCKS[id] = { name: `Bloque desconocido (${clave})`, tiles: [TILE_DESCONOCIDO, TILE_DESCONOCIDO, TILE_DESCONOCIDO], hardness: 1.5, desconocido: true, mod: clave.split(':')[0] };
    faltan.add(clave.split(':')[0]);
  }
  for (const [clave, id] of Object.entries(tabla.objetos)) {
    if (registrados.objetos.has(clave) || ITEMS[id]) continue;
    ITEMS[id] = { name: `Objeto desconocido (${clave})`, desconocido: true, mod: clave.split(':')[0] };
    spriteDesconocido(id);
    faltan.add(clave.split(':')[0]);
  }
  actualizarTablas();
  const avisos = [];
  if (faltan.size) avisos.push('Faltan mods de este mundo: ' + [...faltan].join(', '));
  if (fallidos.length) avisos.push(`${fallidos.length} mod(s) con errores (F12)`);
  if (avisos.length) setTimeout(() => toast(avisos.join(' · ')), 600);
}

// Lo que se guarda en el mundo
const estadoMods = () => ({ tabla: { bloques: { ...tabla.bloques }, objetos: { ...tabla.objetos } }, lista: cargados.map(c => ({ id: c.id, version: c.version })) });
const modsCargados = () => ({ cargados: [...cargados], fallidos: [...fallidos] });

export { API_VERSION, cargarMods, estadoMods, modsCargados };
