// Proceso principal de Electron: solo crea la ventana.
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'MiniCraft',
    backgroundColor: '#87ceeb',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  // F12 abre las herramientas de desarrollador (consola, errores).
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
