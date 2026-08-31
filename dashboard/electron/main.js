const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let sidecarProcess = null;
const SIDECAR_PORT = 8765;

// User Config file for storing custom data directory
const CONFIG_FILE = path.join(app.getPath('userData'), 'user_config.json');

function getStoredDataDir() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (data.customDataDir && fs.existsSync(data.customDataDir)) {
        return data.customDataDir;
      }
    }
  } catch (e) {
    console.error('Error reading user_config.json:', e);
  }
  // Default to ~/Library/Application Support/StockWave/data (or project data in dev)
  return !app.isPackaged 
    ? path.resolve(__dirname, '../../data')
    : path.join(app.getPath('userData'), 'data');
}

function setStoredDataDir(newPath) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ customDataDir: newPath }, null, 2));
    return true;
  } catch (e) {
    console.error('Error saving user_config.json:', e);
    return false;
  }
}

// IPC Handlers for Settings page
ipcMain.handle('dialog:selectFolder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('config:getDataDir', async () => {
  return getStoredDataDir();
});

ipcMain.handle('config:setDataDir', async (_event, newPath) => {
  return setStoredDataDir(newPath);
});

function startPythonSidecar(onReady) {
  // Check if sidecar is already running (e.g. during rapid dev reloads)
  http.get(`http://127.0.0.1:${SIDECAR_PORT}/api/health`, (res) => {
    if (res.statusCode === 200) {
      console.log('[Sidecar] Existing sidecar detected on port', SIDECAR_PORT);
      onReady();
      return;
    }
    spawnNewSidecar(onReady);
  }).on('error', () => {
    spawnNewSidecar(onReady);
  });
}

function ensureDataDirectorySeeded(targetDataDir) {
  try {
    const isDev = !app.isPackaged;
    const seedSourceDir = isDev
      ? path.resolve(__dirname, '../../data')
      : path.join(process.resourcesPath, 'seed_data');

    if (!fs.existsSync(seedSourceDir)) return;

    // Ensure target subdirectories exist
    ['db', 'inputs', 'outputs'].forEach(sub => {
      fs.mkdirSync(path.join(targetDataDir, sub), { recursive: true });
    });

    // Seed SQLite DB if not present
    const targetDb = path.join(targetDataDir, 'db', 'etfs.db');
    const seedDb = path.join(seedSourceDir, 'db', 'etfs.db');
    if (!fs.existsSync(targetDb) && fs.existsSync(seedDb)) {
      fs.copyFileSync(seedDb, targetDb);
      console.log('[Seed] Copied initial etfs.db database to', targetDb);
    }

    // Seed output JSONs if not present
    const seedOutputs = path.join(seedSourceDir, 'outputs');
    if (fs.existsSync(seedOutputs)) {
      fs.readdirSync(seedOutputs).forEach(file => {
        const dest = path.join(targetDataDir, 'outputs', file);
        if (!fs.existsSync(dest)) {
          const src = path.join(seedOutputs, file);
          if (fs.statSync(src).isFile()) {
            fs.copyFileSync(src, dest);
          }
        }
      });
    }
  } catch (e) {
    console.error('[Seed] Error seeding initial data directory:', e);
  }
}

function spawnNewSidecar(onReady) {
  const isDev = !app.isPackaged;
  const customDataDir = getStoredDataDir();
  
  // Seed database and outputs on first run
  ensureDataDirectorySeeded(customDataDir);

  console.log('[Sidecar] Launching sidecar with data dir:', customDataDir, '(Packaged:', !isDev, ')');

  if (isDev) {
    // Development mode: spawn via uv run python src/server.py
    const projectRoot = path.resolve(__dirname, '../..');
    sidecarProcess = spawn(
      'uv',
      ['run', 'python', 'src/server.py', '--port', String(SIDECAR_PORT)],
      {
        cwd: projectRoot,
        env: { 
          ...process.env, 
          PYTHONUNBUFFERED: '1',
          STOCKWAVE_DATA_DIR: customDataDir 
        }
      }
    );
  } else {
    // Packaged mode: execute bundled standalone binary
    const binaryName = process.platform === 'win32' ? 'stockwave-sidecar.exe' : 'stockwave-sidecar';
    const binaryPath = path.join(process.resourcesPath, 'sidecar_bin', binaryName);

    console.log('[Sidecar] Executing standalone binary at:', binaryPath);
    sidecarProcess = spawn(
      binaryPath,
      ['--port', String(SIDECAR_PORT)],
      {
        env: { 
          ...process.env, 
          PYTHONUNBUFFERED: '1',
          STOCKWAVE_DATA_DIR: customDataDir 
        }
      }
    );
  }

  sidecarProcess.stdout?.on('data', (data) => {
    console.log(`[Sidecar STDOUT] ${data}`);
  });

  sidecarProcess.stderr?.on('data', (data) => {
    console.error(`[Sidecar STDERR] ${data}`);
  });

  sidecarProcess.on('close', (code) => {
    console.log(`[Sidecar] Process exited with code ${code}`);
  });

  waitForSidecar(onReady);
}



function waitForSidecar(callback, maxRetries = 20) {
  let retries = 0;
  const checkHealth = () => {
    http.get(`http://127.0.0.1:${SIDECAR_PORT}/api/health`, (res) => {
      if (res.statusCode === 200) {
        console.log('[Sidecar] Health check passed!');
        callback();
      } else {
        retry();
      }
    }).on('error', () => {
      retry();
    });
  };

  const retry = () => {
    retries++;
    if (retries < maxRetries) {
      setTimeout(checkHealth, 300);
    } else {
      console.warn('[Sidecar] Health check timeout, opening window anyway...');
      callback();
    }
  };

  checkHealth();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'StockWave Analyzer AI',
    backgroundColor: '#0a0d14',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Inject sidecar port dynamically into frontend window
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(
      `window.__SIDECAR_URL__ = 'http://127.0.0.1:${SIDECAR_PORT}';`
    );
  });

  const isDev = !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle external links safely in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startPythonSidecar(createWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});


app.on('will-quit', () => {
  if (sidecarProcess) {
    console.log('[Sidecar] Terminating Python process cleanly...');
    sidecarProcess.kill('SIGTERM');
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

