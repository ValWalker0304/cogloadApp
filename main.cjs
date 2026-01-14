const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 600,
    transparent: true,
    frame: false,
    hasShadow: true,
    resizable: false, // LOCKS user resizing (Point 1)
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadURL('http://localhost:5173');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

ipcMain.on('resize-window', (event, isExpanded) => {
  if (!mainWindow) return;

  if (isExpanded) {
    mainWindow.setContentSize(900, 600, true); 
  } else {
    mainWindow.setContentSize(420, 600, true);
  }
});

// Uncoment and fix path for app to work on login
ipcMain.on('toggle-auto-start', (event, enable) => {
  // app.setLoginItemSettings({
  //   openAtLogin: enable,
  //   path: app.getPath('exe'),
  //   openAsHidden: false
  // });
});

function startPythonBackend() {
  const scriptPath = path.join(__dirname, 'backend', 'backend.py');
  pythonProcess = spawn('python', [scriptPath]);
  pythonProcess.stdout.on('data', (data) => console.log(`Backend: ${data}`));
  pythonProcess.stderr.on('data', (data) => console.error(`Backend Error: ${data}`));
}

app.on('ready', () => {
  setTimeout(() => {
    startPythonBackend();
    createWindow();
  }, 100);
});

app.on('will-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});