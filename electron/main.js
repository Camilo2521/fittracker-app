'use strict';

const { app, BrowserWindow, Tray, Menu, shell, dialog, nativeImage } = require('electron');
const { spawn } = require('child_process');
const path  = require('path');
const http  = require('http');
const fs    = require('fs');

// ── Paths ────────────────────────────────────────────────────────────────────
const ROOT    = path.join(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const WWW     = path.join(ROOT, 'frontend', 'www');
const PYTHON  = path.join(ROOT, 'python_service');
const ICON    = path.join(WWW, 'icons', fs.existsSync(path.join(WWW,'icons','icon-256.png')) ? 'icon-256.png' : 'icon-512.png');

// ── State ────────────────────────────────────────────────────────────────────
let mainWindow = null;
let tray       = null;
let nodeProc   = null;
let pyProc     = null;
let httpServer = null;

const PORTS = { frontend: 8080, backend: 3000, python: 8000 };

// ── Single instance lock ──────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.on('second-instance', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });

// ── Spawn backend services ────────────────────────────────────────────────────
function spawnBackend() {
  const nodePath = process.execPath; // use same node that runs electron
  nodeProc = spawn(nodePath, ['src/app.js'], {
    cwd: BACKEND, stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production', PORT: '3000' },
  });
  nodeProc.stdout.on('data', d => console.log('[backend]', d.toString().trim()));
  nodeProc.stderr.on('data', d => console.error('[backend]', d.toString().trim()));
  nodeProc.on('exit', code => console.log('[backend] exited', code));
}

function spawnPython() {
  // Prefer explicit env var, then platform default
  const candidates = process.env.PYTHON_PATH
    ? [process.env.PYTHON_PATH]
    : process.platform === 'win32'
      ? ['python', 'python3', 'py']
      : ['python3', 'python'];
  let pyExe = null;
  for (const p of candidates) {
    try { require('child_process').execSync(`"${p}" --version`, { stdio: 'pipe' }); pyExe = p; break; } catch {}
  }
  if (!pyExe || !fs.existsSync(PYTHON)) { console.warn('[python] not found, skipping'); return; }
  pyProc = spawn(pyExe, ['-m', 'uvicorn', 'app.main:app', '--port', '8000', '--host', '127.0.0.1'], {
    cwd: PYTHON, stdio: 'pipe',
  });
  pyProc.stdout.on('data', d => console.log('[python]', d.toString().trim()));
  pyProc.stderr.on('data', d => console.log('[python]', d.toString().trim()));
}

function spawnFrontend() {
  // Serve static files with a minimal built-in http server
  httpServer = http.createServer((req, res) => {
    let filePath = path.join(WWW, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(filePath)) filePath = path.join(WWW, 'index.html');
    const ext = path.extname(filePath).toLowerCase();
    const mime = {
      '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
      '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
      '.svg':'image/svg+xml', '.ico':'image/x-icon', '.webp':'image/webp',
      '.woff2':'font/woff2', '.woff':'font/woff', '.ttf':'font/ttf',
    }[ext] || 'application/octet-stream';
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', mime);
    fs.createReadStream(filePath).pipe(res);
  });
  httpServer.listen(PORTS.frontend, '127.0.0.1', () =>
    console.log(`[frontend] serving on http://localhost:${PORTS.frontend}`)
  );
  httpServer.on('error', err => console.error('[frontend]', err.message));
}

// ── Wait for backend to be ready ──────────────────────────────────────────────
function waitForPort(port, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      const req = http.request({ host: '127.0.0.1', port, path: '/', method: 'GET' }, () => resolve());
      req.on('error', () => {
        if (Date.now() - start > timeout) return reject(new Error(`Port ${port} not ready`));
        setTimeout(check, 400);
      });
      req.end();
    }
    check();
  });
}

// ── Create main window ────────────────────────────────────────────────────────
function createWindow() {
  const icon = fs.existsSync(ICON) ? nativeImage.createFromPath(ICON) : undefined;
  mainWindow = new BrowserWindow({
    width:  1100,
    height: 780,
    minWidth:  375,
    minHeight: 600,
    icon,
    title: 'FitTracker',
    backgroundColor: '#0F0F0D',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // webSecurity left at default (true) — CORS is handled server-side
    },
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  mainWindow.loadURL(`http://localhost:${PORTS.frontend}`);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });

  // Open external links in browser, not in app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url); return { action: 'deny' };
  });
}

function createTray() {
  if (!fs.existsSync(ICON)) return;
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('FitTracker');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir FitTracker', click: () => { if (mainWindow) mainWindow.show(); else createWindow(); } },
    { type: 'separator' },
    { label: 'Salir', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
  tray.on('double-click', () => { if (mainWindow) mainWindow.show(); });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Start all services
  spawnFrontend();
  spawnBackend();
  spawnPython();
  createTray();

  // Show splash/loading while backend starts
  const splash = new BrowserWindow({
    width: 380, height: 260,
    frame: false, alwaysOnTop: true,
    backgroundColor: '#0F0F0D',
    transparent: false,
    resizable: false,
  });
  splash.loadURL(`data:text/html,<html><body style="background:#0F0F0D;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui,sans-serif;color:#fff;">
    <div style="font-size:28px;font-weight:900;color:#4DEB6E;margin-bottom:8px;">FitTracker</div>
    <div style="color:#ffffff66;font-size:13px;margin-bottom:24px;">Iniciando servicios...</div>
    <div style="width:180px;height:4px;background:#1a1a17;border-radius:2px;overflow:hidden;">
      <div style="height:100%;width:60%;background:#4DEB6E;border-radius:2px;animation:slide 1.2s ease-in-out infinite;" id="bar"></div>
    </div>
    <style>@keyframes slide{0%{margin-left:-60%}100%{margin-left:100%}}</style>
  </body></html>`);

  try {
    await waitForPort(PORTS.backend, 20000);
  } catch (e) {
    console.warn('[app] backend timeout, loading anyway');
  }

  createWindow();
  splash.destroy();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (nodeProc) nodeProc.kill();
  if (pyProc)   pyProc.kill();
  if (httpServer) httpServer.close();
});
