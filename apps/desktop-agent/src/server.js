import express from "express";
import cors from "cors";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const execAsync = promisify(exec);
const PORT = Number(process.env.JARVIS_AGENT_PORT || 3847);
const CACHE_PATH = path.join(os.homedir(), ".jarvis-apps-cache.json");
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "64kb" }));

function quotePath(p) {
  return `"${String(p).replace(/"/g, "")}"`;
}

async function runWindows(command, timeout = 20000) {
  const wrapped = `cmd /c ${command}`;
  const { stdout, stderr } = await execAsync(wrapped, {
    windowsHide: true,
    timeout,
    maxBuffer: 8 * 1024 * 1024,
  });
  return { stdout: stdout?.trim() || "", stderr: stderr?.trim() || "" };
}

function chromeBrowseCmd() {
  const candidates = [
    process.env.LOCALAPPDATA
      ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
      : null,
    process.env.ProgramFiles
      ? `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`
      : null,
    process.env["ProgramFiles(x86)"]
      ? `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`
      : null,
  ].filter(Boolean);
  for (const exe of candidates) {
    if (fs.existsSync(exe)) {
      return `start "" ${quotePath(exe)} --new-window about:blank`;
    }
  }
  return 'start "" chrome --new-window about:blank';
}

/** Fast aliases — always preferred when they match. */
const APP_MAP = {
  chrome: chromeBrowseCmd(),
  "google chrome": chromeBrowseCmd(),
  edge: 'start "" msedge --new-window about:blank',
  firefox: "start firefox",
  code: "code",
  "vs code": "code",
  vscode: "code",
  cursor: "cursor",
  notepad: "notepad",
  explorer: "explorer",
  "file explorer": "explorer",
  terminal: "start wt",
  "windows terminal": "start wt",
  powershell: "start powershell",
  calc: "calc",
  calculator: "calc",
  spotify: "start spotify:",
  discord: "start discord:",
  whatsapp: "start whatsapp:",
  slack: "start slack:",
  notion: "start notion:",
  figma: "start figma:",
  outlook: "start outlook:",
  excel: "start excel",
  word: "start winword",
  powerpoint: "start powerpnt",
  teams: "start msteams:",
  steam: "start steam:",
};

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\.lnk$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreMatch(query, candidateName) {
  const q = normalizeName(query);
  const n = normalizeName(candidateName);
  if (!q || !n) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 90;
  if (n.includes(q)) return 75;
  const qParts = q.split(/\s+/);
  if (qParts.every((p) => n.includes(p))) return 65;
  return 0;
}

/** Scan Start Menu shortcuts via PowerShell COM. */
async function scanInstalledApps() {
  const ps = `
$ErrorActionPreference='SilentlyContinue'
$shell = New-Object -ComObject WScript.Shell
$roots = @(
  "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
  "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs"
)
$seen = @{}
$out = @()
foreach ($root in $roots) {
  if (-not (Test-Path $root)) { continue }
  Get-ChildItem -Path $root -Recurse -Filter *.lnk | ForEach-Object {
    try {
      $sc = $shell.CreateShortcut($_.FullName)
      $target = [string]$sc.TargetPath
      $name = [string]$_.BaseName
      if (-not $name) { return }
      $key = ($name + '|' + $target).ToLowerInvariant()
      if ($seen.ContainsKey($key)) { return }
      $seen[$key] = $true
      if ($target -and ($target -notmatch '\\Windows\\|InstallShield|Uninstall|Update|Setup\\.exe')) {
        $out += [PSCustomObject]@{
          name = $name
          target = $target
          lnk = [string]$_.FullName
        }
      } elseif ($_.FullName) {
        $out += [PSCustomObject]@{
          name = $name
          target = ''
          lnk = [string]$_.FullName
        }
      }
    } catch {}
  }
}
$out | ConvertTo-Json -Compress
`;
  const encoded = Buffer.from(ps, "utf16le").toString("base64");
  const { stdout } = await runWindows(
    `powershell -NoProfile -EncodedCommand ${encoded}`,
    90000,
  );
  let list = [];
  try {
    const parsed = JSON.parse(stdout || "[]");
    list = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  } catch {
    list = [];
  }
  const apps = list
    .map((a) => ({
      name: String(a.name || "").trim(),
      target: String(a.target || "").trim(),
      lnk: String(a.lnk || "").trim(),
    }))
    .filter((a) => a.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  const payload = { at: Date.now(), count: apps.length, apps };
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(payload), "utf8");
  } catch {
    /* ignore cache write */
  }
  return payload;
}

function readAppCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    const data = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    if (!data?.apps || !Array.isArray(data.apps)) return null;
    return data;
  } catch {
    return null;
  }
}

async function getApps({ force = false } = {}) {
  const cached = readAppCache();
  if (
    !force &&
    cached &&
    Date.now() - Number(cached.at || 0) < CACHE_TTL_MS &&
    cached.apps?.length
  ) {
    return cached;
  }
  return scanInstalledApps();
}

function findApp(query, apps) {
  let best = null;
  let bestScore = 0;
  for (const a of apps) {
    const s = scoreMatch(query, a.name);
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  }
  if (bestScore >= 65) return { app: best, score: bestScore };
  return null;
}

async function openResolvedApp(query) {
  const key = String(query || "")
    .toLowerCase()
    .trim();
  if (APP_MAP[key]) {
    await runWindows(APP_MAP[key]);
    return { ok: true, did: `Opened ${key}`, via: "alias" };
  }

  const catalog = await getApps();
  const hit = findApp(query, catalog.apps || []);
  if (!hit) {
    return {
      ok: false,
      error: `No installed app matched "${query}". Try "scan apps" then ask again, or a clearer name.`,
    };
  }
  const launchPath = hit.app.lnk || hit.app.target;
  if (!launchPath) {
    return { ok: false, error: `Found ${hit.app.name} but no launch path.` };
  }
  await runWindows(`start "" ${quotePath(launchPath)}`);
  return {
    ok: true,
    did: `Opened ${hit.app.name}`,
    via: "scan",
    matched: hit.app.name,
  };
}

async function windowAction(action, titleQuery) {
  const q = String(titleQuery || "").replace(/'/g, "");
  const showMap = { focus: 9, minimize: 6, close: 0 };
  // focus=SW_RESTORE, minimize=SW_MINIMIZE; close uses WM_CLOSE
  const ps = `
$ErrorActionPreference='SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class JarvisWin {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
}
"@
$q = '${q}'.ToLowerInvariant()
$procs = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle }
$hit = $procs | Where-Object { $_.MainWindowTitle.ToLowerInvariant().Contains($q) -or $_.ProcessName.ToLowerInvariant().Contains($q) } | Select-Object -First 1
if (-not $hit) { Write-Output 'NOT_FOUND'; exit 0 }
$h = $hit.MainWindowHandle
$action = '${action}'
if ($action -eq 'close') {
  [void][JarvisWin]::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
  Write-Output ("CLOSED:" + $hit.MainWindowTitle)
} elseif ($action -eq 'minimize') {
  [void][JarvisWin]::ShowWindowAsync($h, 6)
  Write-Output ("MINIMIZED:" + $hit.MainWindowTitle)
} else {
  [void][JarvisWin]::ShowWindowAsync($h, 9)
  [void][JarvisWin]::SetForegroundWindow($h)
  Write-Output ("FOCUSED:" + $hit.MainWindowTitle)
}
`;
  const encoded = Buffer.from(ps, "utf16le").toString("base64");
  const { stdout } = await runWindows(
    `powershell -NoProfile -EncodedCommand ${encoded}`,
  );
  if (!stdout || stdout.includes("NOT_FOUND")) {
    return { ok: false, error: `No window matched "${titleQuery}"` };
  }
  return { ok: true, did: stdout.replace(":", " ") };
}

async function clipboardGet() {
  const { stdout } = await runWindows(
    `powershell -NoProfile -Command "Get-Clipboard -Raw"`,
  );
  return { ok: true, text: stdout || "", did: "Read clipboard" };
}

async function clipboardSet(text) {
  const b64 = Buffer.from(String(text ?? ""), "utf8").toString("base64");
  await runWindows(
    `powershell -NoProfile -Command "$t=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')); Set-Clipboard -Value $t"`,
  );
  return { ok: true, did: "Copied to clipboard" };
}

async function findResume() {
  const home = os.homedir();
  const roots = [
    path.join(home, "Desktop"),
    path.join(home, "Documents"),
    path.join(home, "Downloads"),
  ];
  const patterns = [/resume/i, /cv\b/i, /curriculum/i];
  const hits = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const walk = (dir, depth) => {
      if (depth > 3 || hits.length >= 8) return;
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full, depth + 1);
        else if (patterns.some((p) => p.test(ent.name))) hits.push(full);
      }
    };
    walk(root, 0);
  }
  return hits;
}

async function searchLocalFiles(kind, query) {
  const home = os.homedir();
  const roots = [
    "C:\\PROJECTS",
    path.join(home, "Desktop"),
    path.join(home, "Documents"),
    path.join(home, "Downloads"),
  ].filter((r) => fs.existsSync(r));

  const hits = [];
  const queryLower = query.toLowerCase();

  if (kind === "recent") {
    const ext = queryLower.startsWith(".") ? queryLower : `.${queryLower}`;
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const root of roots) {
      const walk = (dir, depth) => {
        if (depth > 3 || hits.length >= 10) return;
        let entries = [];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const ent of entries) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            if (ent.name.startsWith(".") || ent.name === "node_modules" || ent.name === "out" || ent.name === "build") continue;
            walk(full, depth + 1);
          } else {
            if (ent.name.toLowerCase().endsWith(ext)) {
              try {
                const stat = fs.statSync(full);
                if (stat.mtimeMs >= oneWeekAgo) {
                  hits.push({ name: ent.name, path: full, mtime: stat.mtimeMs });
                }
              } catch {}
            }
          }
        }
      };
      walk(root, 0);
    }
    hits.sort((a, b) => b.mtime - a.mtime);
    return hits.map((h) => h.path);
  }

  if (kind === "directory") {
    for (const root of roots) {
      const walk = (dir, depth) => {
        if (depth > 3 || hits.length >= 10) return;
        let entries = [];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const ent of entries) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            if (ent.name.startsWith(".") || ent.name === "node_modules" || ent.name === "out" || ent.name === "build") continue;
            if (ent.name.toLowerCase() === queryLower) {
              hits.push(full);
            }
            walk(full, depth + 1);
          }
        }
      };
      walk(root, 0);
    }
    return hits;
  }

  if (kind === "file") {
    for (const root of roots) {
      const walk = (dir, depth) => {
        if (depth > 3 || hits.length >= 10) return;
        let entries = [];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const ent of entries) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            if (ent.name.startsWith(".") || ent.name === "node_modules" || ent.name === "out" || ent.name === "build") continue;
            walk(full, depth + 1);
          } else {
            if (ent.name.toLowerCase() === queryLower || ent.name.toLowerCase().includes(queryLower)) {
              hits.push(full);
            }
          }
        }
      };
      walk(root, 0);
    }
    return hits;
  }

  return [];
}

async function openDownloadsToday() {
  const dir = path.join(os.homedir(), "Downloads");
  if (!fs.existsSync(dir)) {
    return { ok: false, error: "Downloads folder not found" };
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const files = fs
    .readdirSync(dir)
    .map((name) => {
      const full = path.join(dir, name);
      try {
        const st = fs.statSync(full);
        return { full, mtime: st.mtimeMs, isFile: st.isFile() };
      } catch {
        return null;
      }
    })
    .filter((f) => f && f.isFile && f.mtime >= start.getTime())
    .sort((a, b) => b.mtime - a.mtime);

  // Open Downloads folder; if files exist, also select first via explorer /select
  if (files.length) {
    await runWindows(`explorer /select,${quotePath(files[0].full)}`);
    return {
      ok: true,
      did: `Opened Downloads (today: ${files.length} file${files.length === 1 ? "" : "s"})`,
      count: files.length,
    };
  }
  await runWindows(`explorer ${quotePath(dir)}`);
  return { ok: true, did: "Opened Downloads (nothing new today)", count: 0 };
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    name: "jarvis-desktop-agent",
    platform: process.platform,
    user: os.userInfo().username,
    home: os.homedir(),
  });
});

app.get("/apps", async (_req, res) => {
  try {
    const catalog = await getApps();
    res.json({
      aliases: Object.keys(APP_MAP),
      count: catalog.count || catalog.apps?.length || 0,
      apps: (catalog.apps || []).map((a) => a.name),
      cachedAt: catalog.at || null,
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "apps list failed",
    });
  }
});

app.post("/apps/scan", async (_req, res) => {
  try {
    const catalog = await scanInstalledApps();
    res.json({
      ok: true,
      count: catalog.count,
      apps: catalog.apps.map((a) => a.name).slice(0, 40),
      did: `Indexed ${catalog.count} apps from Start Menu`,
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "scan failed",
    });
  }
});

app.post("/execute", async (req, res) => {
  try {
    if (process.platform !== "win32") {
      return res.status(400).json({ ok: false, error: "Windows only for v1" });
    }

    const { kind, target, confirm, text } = req.body || {};
    if (!kind) {
      return res.status(400).json({ ok: false, error: "kind required" });
    }

    if (
      (kind === "shell" || kind === "kill" || kind === "power") &&
      confirm !== true
    ) {
      return res.status(403).json({
        ok: false,
        error: "Risky action requires confirm:true",
        needsConfirm: true,
      });
    }

    if (kind === "scan_apps") {
      const catalog = await scanInstalledApps();
      return res.json({
        ok: true,
        did: `Indexed ${catalog.count} installed apps`,
        count: catalog.count,
      });
    }

    if (kind === "open_app") {
      const result = await openResolvedApp(target);
      if (!result.ok) {
        return res.status(404).json(result);
      }
      return res.json(result);
    }

    if (kind === "open_url") {
      const url = String(target || "").trim();
      if (!/^https?:\/\//i.test(url)) {
        return res
          .status(400)
          .json({ ok: false, error: "URL must start with http(s)://" });
      }
      await runWindows(`start "" ${quotePath(url)}`);
      return res.json({ ok: true, did: `Opened ${url}` });
    }

    if (kind === "open_path") {
      let p = String(target || "").trim();
      if (!p) return res.status(400).json({ ok: false, error: "path required" });

      if (p.toLowerCase() === "downloads_today") {
        const result = await openDownloadsToday();
        return res.status(result.ok ? 200 : 404).json(result);
      }
      if (p.toLowerCase() === "resume") {
        const hits = await findResume();
        if (!hits.length) {
          return res.status(404).json({
            ok: false,
            error: "No resume/CV file found on Desktop, Documents, or Downloads",
          });
        }
        await runWindows(`explorer /select,${quotePath(hits[0])}`);
        return res.json({
          ok: true,
          did: `Found resume: ${path.basename(hits[0])}`,
          path: hits[0],
        });
      }

      if (p === "~" || p.toLowerCase() === "home") p = os.homedir();
      if (p.toLowerCase() === "desktop") p = path.join(os.homedir(), "Desktop");
      if (p.toLowerCase() === "downloads")
        p = path.join(os.homedir(), "Downloads");
      if (p.toLowerCase() === "documents")
        p = path.join(os.homedir(), "Documents");
      if (p.toLowerCase() === "project" || p.toLowerCase() === "jarvis") {
        p = "C:\\PROJECTS\\JARVIS";
      }
      // Absolute custom path from memory
      if (!fs.existsSync(p) && !/^[a-z]:\\/i.test(p)) {
        return res.status(404).json({ ok: false, error: `Path not found: ${p}` });
      }
      await runWindows(`explorer ${quotePath(p)}`);
      return res.json({ ok: true, did: `Opened ${p}` });
    }

    if (kind === "window") {
      const action = String(target || "focus").toLowerCase();
      const title = String(text || req.body.title || "").trim();
      if (!title) {
        return res
          .status(400)
          .json({ ok: false, error: "window title/app name required" });
      }
      if (!["focus", "minimize", "close"].includes(action)) {
        return res.status(400).json({
          ok: false,
          error: "window action must be focus, minimize, or close",
        });
      }
      if (action === "close" && confirm !== true) {
        return res.status(403).json({
          ok: false,
          error: "Closing a window requires confirm:true",
          needsConfirm: true,
        });
      }
      const result = await windowAction(action, title);
      return res.status(result.ok ? 200 : 404).json(result);
    }

    if (kind === "clipboard_get") {
      const result = await clipboardGet();
      return res.json(result);
    }

    if (kind === "clipboard_set") {
      const value = text ?? target ?? "";
      const result = await clipboardSet(value);
      return res.json(result);
    }

    if (kind === "power") {
      const mode = String(target || "")
        .toLowerCase()
        .trim();
      if (mode === "sleep") {
        await runWindows(
          `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [void][System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)"`,
        );
        return res.json({ ok: true, did: "PC entering sleep" });
      }
      if (mode === "hibernate") {
        await runWindows("shutdown /h");
        return res.json({ ok: true, did: "PC hibernating" });
      }
      if (mode === "restart") {
        await runWindows("shutdown /r /t 0");
        return res.json({ ok: true, did: "PC restarting" });
      }
      if (mode === "shutdown" || mode === "poweroff" || mode === "off") {
        await runWindows("shutdown /s /t 0");
        return res.json({ ok: true, did: "PC shutting down" });
      }
      return res.status(400).json({
        ok: false,
        error: "Unknown power mode. Use sleep, hibernate, restart, or shutdown.",
      });
    }

    if (kind === "shell") {
      const cmd = String(target || "").trim();
      if (!cmd)
        return res.status(400).json({ ok: false, error: "command required" });
      if (/(format\s|del\s\/s|rm\s-rf|shutdown|rmdir\s\/s)/i.test(cmd)) {
        return res
          .status(403)
          .json({ ok: false, error: "Command blocked by safety filter" });
      }
      const out = await runWindows(cmd);
      return res.json({ ok: true, did: "Ran command", ...out });
    }

    if (kind === "file_search") {
      const query = text ?? target ?? "";
      if (!query) {
        return res.status(400).json({ ok: false, error: "search query required" });
      }
      const results = await searchLocalFiles(target, query);
      if (!results.length) {
        let msg = `No matches found for ${target} "${query}"`;
        if (target === "directory") {
          msg = `I couldn't find a project folder named "${query}".`;
        } else if (target === "recent") {
          msg = `I couldn't find any recent "${query}" files modified in the last 7 days.`;
        }
        return res.json({ ok: true, did: msg, text: msg, count: 0 });
      }

      if (target === "directory") {
        try {
          await runWindows(`start "" ${quotePath(results[0])}`);
        } catch {
          // ignore exit code issues since start/explorer opens the folder anyway
        }
        return res.json({
          ok: true,
          did: `Found and opened folder: ${path.basename(results[0])}`,
          text: `Found project folder at: ${results[0]} (opened in explorer).`,
          count: results.length,
          paths: results
        });
      }

      if (target === "recent") {
        const fileNames = results.map(p => path.basename(p));
        const summary = `Found ${results.length} recent files:\n` + fileNames.slice(0, 5).map(f => `- ${f}`).join("\n");
        return res.json({
          ok: true,
          did: `Located ${results.length} recent ${query.toUpperCase()} files.`,
          text: summary,
          count: results.length,
          paths: results
        });
      }

      const fileNames = results.map(p => path.basename(p));
      return res.json({
        ok: true,
        did: `Found ${results.length} matching files.`,
        text: `Matches:\n` + fileNames.slice(0, 5).map(f => `- ${f}`).join("\n"),
        count: results.length,
        paths: results
      });
    }

    return res.status(400).json({ ok: false, error: `Unknown kind: ${kind}` });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "execute failed",
    });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`JARVIS desktop agent on http://127.0.0.1:${PORT}`);
  // Warm app cache in background
  void getApps().catch(() => {});
});
