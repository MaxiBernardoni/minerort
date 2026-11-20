// ============================================================
// menu.js - Menu principal: elegir, crear y borrar mundos.
// Solo existe dentro de Electron (necesita window.guardado). Elegir o crear un mundo recarga la pagina con
// ?mundo=... (ver guardado.js); asi cada mundo arranca desde cero, sin restos del anterior.
// ============================================================
const el = id => document.getElementById(id);

// Un numero se usa tal cual; un texto da un numero que sale del texto (mismo texto, mismo mundo)
function semillaDeTexto(texto) {
  const t = texto.trim();
  if (/^-?\d+$/.test(t)) return parseInt(t, 10) | 0;
  let h = 0;
  for (const c of t) h = (Math.imul(h, 31) + c.codePointAt(0)) | 0;
  return h;
}

function jugar(id, nombre) {
  location.search = `?mundo=${id}&nombre=${encodeURIComponent(nombre)}`;
}

function boton(texto, clase, alClick) {
  const b = document.createElement('button');
  b.textContent = texto;
  b.className = clase;
  b.addEventListener('click', alClick);
  return b;
}

async function pintarLista() {
  const lista = el('menuLista');
  const mundos = await window.guardado.listar();
  lista.textContent = '';
  if (!mundos.length) {
    const vacio = document.createElement('p');
    vacio.className = 'menuVacio';
    vacio.textContent = 'Todavía no tenés ningún mundo. Creá el primero abajo.';
    lista.appendChild(vacio);
  }
  for (const m of mundos) {
    const fila = document.createElement('div');
    fila.className = 'mundo';
    fila.dataset.id = m.id;
    const info = document.createElement('div');
    info.className = 'mundoInfo';
    const nombre = document.createElement('strong');
    nombre.textContent = m.nombre;                                   // textContent: el nombre lo escribe el usuario
    const detalle = document.createElement('span');
    detalle.textContent = `Semilla ${m.semilla} · ${new Date(m.ultimaVez).toLocaleString('es-AR')}`;
    info.append(nombre, detalle);

    const borrar = boton('Borrar', 'borrarBtn', async () => {
      if (borrar.dataset.confirmando) {                              // el segundo click borra de verdad
        await window.guardado.borrar(m.id);
        pintarLista();
        return;
      }
      borrar.dataset.confirmando = '1';
      borrar.textContent = '¿Seguro?';
      setTimeout(() => { delete borrar.dataset.confirmando; borrar.textContent = 'Borrar'; }, 4000);
    });
    fila.append(info, boton('Jugar', 'jugarBtn', () => jugar(m.id, m.nombre)), borrar);
    lista.appendChild(fila);
  }
  el('nuevoNombre').placeholder = `Mundo ${mundos.length + 1}`;
}

export async function mostrarMenu() {
  window.guardado.alCerrar(async () => {});                          // en el menu no hay nada que guardar: confirma enseguida para que cerrar no espere
  el('overlay').style.display = 'none';
  el('menu').style.display = 'flex';
  await pintarLista();

  const crear = () => {
    const nombre = el('nuevoNombre').value.trim() || el('nuevoNombre').placeholder;
    const texto = el('nuevaSemilla').value;
    const semilla = texto.trim() ? semillaDeTexto(texto) : Math.floor(Math.random() * 1e9);
    const id = 'mundo-' + Date.now().toString(36);                  // letras minusculas, numeros y guion (lo exige guardado-main.js)
    location.search = `?mundo=${id}&semilla=${semilla}&nombre=${encodeURIComponent(nombre)}`;
  };
  el('crearBtn').addEventListener('click', crear);
  for (const campo of [el('nuevoNombre'), el('nuevaSemilla')]) campo.addEventListener('keydown', e => { if (e.key === 'Enter') crear(); });
}
