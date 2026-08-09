import express from "express";
import cors from "cors";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";

const execAsync = promisify(exec);
const PORT = Number(process.env.JARVIS_AGENT_PORT || 3847);
const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "32kb" }));

/** Known apps on Windows (extend as needed) */
const APP_MAP = {
      chrome: 'start "" chrome --new-window',
      "google chrome": 'start "" chrome --new-window',
      edge: 'start "" msedge --new-window',
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
};

function quotePath(p) {
  return `"${p.replace(/"/g, "")}"`;
}

async function runWindows(command) {
  // Use cmd so `start` works consistently
  const wrapped = `cmd /c ${command}`;
  const { stdout, stderr } = await execAsync(wrapped, {
    windowsHide: true,
    timeout: 15000,
  });
  return { stdout: stdout?.trim() || "", stderr: stderr?.trim() || "" };
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

app.get("/apps", (_req, res) => {
  res.json({ apps: Object.keys(APP_MAP) });
});

app.post("/execute", async (req, res) => {
  try {
    if (process.platform !== "win32") {
      return res.status(400).json({ ok: false, error: "Windows only for v1" });
    }

    const { kind, target, confirm } = req.body || {};
    if (!kind) {
      return res.status(400).json({ ok: false, error: "kind required" });
    }

    // Destructive / shell / power need explicit confirm:true
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

    if (kind === "open_app") {
      const key = String(target || "")
        .toLowerCase()
        .trim();
      const cmd = APP_MAP[key];
      if (!cmd) {
        return res.status(404).json({
          ok: false,
          error: `Unknown app "${target}". Try: ${Object.keys(APP_MAP).slice(0, 8).join(", ")}`,
        });
      }
      await runWindows(cmd);
      return res.json({ ok: true, did: `Opened ${key}` });
    }

    if (kind === "open_url") {
      const url = String(target || "").trim();
      if (!/^https?:\/\//i.test(url)) {
        return res.status(400).json({ ok: false, error: "URL must start with http(s)://" });
      }
      await runWindows(`start "" ${quotePath(url)}`);
      return res.json({ ok: true, did: `Opened ${url}` });
    }

    if (kind === "open_path") {
      let p = String(target || "").trim();
      if (!p) return res.status(400).json({ ok: false, error: "path required" });
      if (p === "~" || p.toLowerCase() === "home") p = os.homedir();
      if (p.toLowerCase() === "desktop") p = path.join(os.homedir(), "Desktop");
      if (p.toLowerCase() === "downloads") p = path.join(os.homedir(), "Downloads");
      if (p.toLowerCase() === "documents") p = path.join(os.homedir(), "Documents");
      if (p.toLowerCase() === "project" || p.toLowerCase() === "jarvis") {
        p = "C:\\PROJECTS\\JARVIS";
      }
      await runWindows(`explorer ${quotePath(p)}`);
      return res.json({ ok: true, did: `Opened ${p}` });
    }

    if (kind === "power") {
      const mode = String(target || "")
        .toLowerCase()
        .trim();
      if (mode === "sleep") {
        // Suspend (sleep). ForceCritical=false so apps can veto if needed.
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
        error: 'Unknown power mode. Use sleep, hibernate, restart, or shutdown.',
      });
    }

    if (kind === "shell") {
      const cmd = String(target || "").trim();
      if (!cmd) return res.status(400).json({ ok: false, error: "command required" });
      // Hard deny obvious danger
      if (/(format\s|del\s\/s|rm\s-rf|shutdown|rmdir\s\/s)/i.test(cmd)) {
        return res.status(403).json({ ok: false, error: "Command blocked by safety filter" });
      }
      const out = await runWindows(cmd);
      return res.json({ ok: true, did: "Ran command", ...out });
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
  console.log("Keep this terminal open while using the web UI.");
});
