/**
 * JARVIS desktop host (UI shell)
 *
 * Prefer: START_JARVIS.cmd starts agent + web in their own CMD windows,
 * then launches this Electron app with JARVIS_UI_ONLY=1 so we only
 * wait for http://127.0.0.1:3000 and show the window (no port killing).
 *
 * Fallback: if UI_ONLY is not set, we also spawn agent/web ourselves.
 */
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  session,
} = require("electron");
const { spawn, execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const ROOT = path.resolve(__dirname, "../../..");
const WEB_URL = process.env.JARVIS_WEB_URL || "http://127.0.0.1:3000/";
const AGENT_HEALTH =
  process.env.JARVIS_AGENT_URL || "http://127.0.0.1:3847/health";
const UI_ONLY = process.env.JARVIS_UI_ONLY === "1";
const ICON_PATH = path.join(__dirname, "../assets/tray.png");

let tray = null;
let mainWindow = null;
const children = [];
let quitting = false;

function log(msg) {
  console.log(`[jarvis] ${msg}`);
}

function spawnPnpm(filterArgs, name) {
  const logPath = path.join(ROOT, `.jarvis-${name}.log`);
  const out = fs.createWriteStream(logPath, { flags: "a" });
  const child = spawn("pnpm", filterArgs, {
    cwd: ROOT,
    shell: true,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  child.on("exit", (code) => log(`${name} exited (${code})`));
  children.push({ name, child });
  return child;
}

function killChildren() {
  for (const { child } of children) {
    try {
      if (process.platform === "win32" && child.pid) {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          shell: true,
          windowsHide: true,
        });
      } else {
        child.kill("SIGTERM");
      }
    } catch {
      /* ignore */
    }
  }
  children.length = 0;
}

function freePort(port) {
  if (process.platform !== "win32") return;
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, {
      encoding: "utf8",
      windowsHide: true,
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, {
          stdio: "ignore",
          windowsHide: true,
        });
        log(`freed :${port} (pid ${pid})`);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* empty */
  }
}

function httpGet(url, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
  });
}

async function isWebReady() {
  try {
    const { status, body } = await httpGet(WEB_URL);
    if (status < 200 || status >= 500) return false;
    // Prefer real app HTML, but accept any 200 once Next is listening
    return (
      /J\.?A\.?R\.?V\.?I\.?S/i.test(body) ||
      /__NEXT_DATA__|_next\/static|id="__next"/i.test(body) ||
      status === 200
    );
  } catch {
    return false;
  }
}

async function isAgentReady() {
  try {
    const { status } = await httpGet(AGENT_HEALTH);
    return status >= 200 && status < 500;
  } catch {
    return false;
  }
}

async function waitUntil(check, label, tries = 90) {
  for (let i = 1; i <= tries; i++) {
    if (await check()) {
      log(`${label} ready`);
      return true;
    }
    if (i === 1 || i % 5 === 0) {
      log(`waiting for ${label}… ${i}s`);
      updateLoading(`Waiting for ${label}… ${i}s`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function trayIcon() {
  if (fs.existsSync(ICON_PATH)) {
    const img = nativeImage.createFromPath(ICON_PATH);
    if (!img.isEmpty()) return img.resize({ width: 16, height: 16 });
  }
  return nativeImage.createEmpty();
}

function allowMic() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(
      ["media", "microphone", "audioCapture", "mediaKeySystem"].includes(
        permission,
      ),
    );
  });
  ses.setPermissionCheckHandler((_wc, permission) =>
    ["media", "microphone", "audioCapture"].includes(permission),
  );
}

function loadingHtml(message) {
  const msg = String(message || "Starting systems…").replace(/</g, "");
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html><head><meta charset="utf-8"/><title>J.A.R.V.I.S.</title>
<style>
  html,body{margin:0;height:100%;background:#05080f;color:#3dd6c6;
  font-family:Segoe UI,system-ui,sans-serif;display:flex;align-items:center;
  justify-content:center;flex-direction:column;gap:12px}
  h1{letter-spacing:.35em;font-size:28px;margin:0;color:#fff}
  p{opacity:.75;font-size:13px;letter-spacing:.12em;text-transform:uppercase}
</style></head>
<body>
  <h1>J.A.R.V.I.S.</h1>
  <p id="m">${msg}</p>
</body></html>`)}`;
}

function ensureWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "J.A.R.V.I.S.",
    backgroundColor: "#05080f",
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    log(`load failed ${code} ${desc} @ ${url}`);
    updateLoading(`UI load failed (${desc}). Retrying…`);
    setTimeout(() => {
      if (!quitting && mainWindow && !mainWindow.isDestroyed()) {
        void loadAppWhenReady();
      }
    }, 2000);
  });

  mainWindow.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

function updateLoading(message) {
  const win = ensureWindow();
  void win.loadURL(loadingHtml(message));
}

async function loadAppWhenReady() {
  const ok = await isWebReady();
  if (!ok) {
    updateLoading("Web UI not ready yet…");
    return false;
  }
  const win = ensureWindow();
  log(`loading ${WEB_URL}`);
  await win.loadURL(WEB_URL);
  win.show();
  win.focus();
  return true;
}

function showWindow() {
  const win = ensureWindow();
  if (win.isVisible()) win.focus();
  else win.show();
  void loadAppWhenReady();
}

function buildMenu() {
  const login = app.getLoginItemSettings().openAtLogin;
  return Menu.buildFromTemplate([
    { label: "Show JARVIS", click: () => showWindow() },
    {
      label: "Reload UI",
      click: () => {
        void loadAppWhenReady();
      },
    },
    { type: "separator" },
    {
      label: "Start with Windows",
      type: "checkbox",
      checked: login,
      click: (item) => {
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          openAsHidden: true,
          path: process.execPath,
          args: app.isPackaged
            ? []
            : [path.join(__dirname, "main.cjs")],
        });
      },
    },
    { type: "separator" },
    {
      label: "Quit JARVIS",
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
}

async function bootServices() {
  if (UI_ONLY) {
    log("UI-only mode — expecting agent/web already started by START_JARVIS.cmd");
    return;
  }

  if (!(await isAgentReady())) {
    freePort(3847);
    log("starting agent…");
    spawnPnpm(["--filter", "@jarvis/desktop-agent", "dev"], "agent");
  } else log("reusing agent");

  if (!(await isWebReady())) {
    freePort(3000);
    log("starting web…");
    spawnPnpm(["--filter", "@jarvis/web", "dev"], "web");
  } else log("reusing web");
}

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.jarvis.host");
  }

  allowMic();
  tray = new Tray(trayIcon());
  tray.setToolTip("JARVIS — starting…");
  tray.setContextMenu(buildMenu());
  tray.on("double-click", () => showWindow());
  globalShortcut.register("CommandOrControl+Shift+J", () => showWindow());

  updateLoading("Booting systems…");
  await bootServices();

  const webOk = await waitUntil(isWebReady, "web UI", UI_ONLY ? 90 : 70);
  const agentOk = await isAgentReady();

  if (!webOk) {
    updateLoading(
      "Web UI failed to start. Check the JARVIS-WEB CMD window, then tray → Reload UI.",
    );
    tray.setToolTip("JARVIS — UI not ready");
    return;
  }

  await loadAppWhenReady();
  tray.setToolTip(
    agentOk
      ? "JARVIS — online · Ctrl+Shift+J"
      : "JARVIS — UI online (agent offline)",
  );
  tray.setContextMenu(buildMenu());
  log("UI attached");
});

app.on("before-quit", () => {
  quitting = true;
  globalShortcut.unregisterAll();
  if (!UI_ONLY) killChildren();
});

app.on("window-all-closed", () => {});
