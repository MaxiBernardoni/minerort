// Proceso principal de Electron: crea la ventana y se ocupa de los archivos de la partida.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { registrar } = require('./guardado-main.js');

registrar(ipcMain, () => app.getPath('userData'));   // %APPDATA%\minicraft en Windows

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'MiniCraft',
    backgroundColor: '#87ceeb',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  // F12 abre las herramientas de desarrollador (consola, errores).
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
  });

  // Antes de cerrar la ventana el juego guarda la partida. Se espera su aviso (como maximo 3 s, por si se colgo).
  let cerrando = false;
  win.on('close', e => {
    if (cerrando) return;
    e.preventDefault();
    cerrando = true;
    let terminado = false;
    const terminar = () => { if (!terminado) { terminado = true; win.close(); } };
    ipcMain.once('mundo:guardado-listo', terminar);
    setTimeout(terminar, 3000);
    try { win.webContents.send('mundo:guardar-ahora'); } catch (err) { terminar(); }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
