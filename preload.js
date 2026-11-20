// ============================================================
// preload.js - Puente entre el juego (pagina) y el proceso principal de Electron.
// Expone solo window.guardado con cinco funciones (listar, cargar, guardar, borrar, alCerrar);
// la pagina no recibe acceso a Node ni a archivos. Los mundos se identifican por un id (ver guardado-main.js).
// ============================================================
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('guardado', {
  listar: () => ipcRenderer.invoke('mundo:listar'),
  cargar: id => ipcRenderer.invoke('mundo:cargar', id),
  guardar: (id, estado) => ipcRenderer.invoke('mundo:guardar', id, estado),
  borrar: id => ipcRenderer.invoke('mundo:borrar', id),
  // main.js pide guardar antes de cerrar la ventana y espera a que terminemos
  alCerrar: funcion => ipcRenderer.on('mundo:guardar-ahora', async () => {
    try { await funcion(); } finally { ipcRenderer.send('mundo:guardado-listo'); }
  }),
});
