/**
 * Headless boot (no Electron): start agent + Next, open browser.
 * Use when you only need terminals: pnpm jarvis:boot
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import open from "open";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const WEB_URL = process.env.JARVIS_WEB_URL || "http://127.0.0.1:3000";
const AGENT_URL = process.env.JARVIS_AGENT_URL || "http://127.0.0.1:3847/health";

const children = [];

function spawnPnpm(args, name) {
  const logPath = path.join(ROOT, `.jarvis-${name}.log`);
  const log = createWriteStream(logPath, { flags: "a" });
  const child = spawn("pnpm", args, {
    cwd: ROOT,
    shell: true,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.on("exit", (code) => {
    console.log(`[jarvis] ${name} exited (${code})`);
  });
  children.push(child);
  return child;
}

async function waitFor(url, label, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`[jarvis] ${label} ready`);
        return true;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function shutdown() {
  for (const c of children) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(c.pid), "/T", "/F"], { shell: true });
      } else {
        c.kill("SIGTERM");
      }
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[jarvis] starting desktop agent…");
spawnPnpm(["--filter", "@jarvis/desktop-agent", "dev"], "agent");

console.log("[jarvis] starting web UI…");
spawnPnpm(["--filter", "@jarvis/web", "dev"], "web");

const agentOk = await waitFor(AGENT_URL, "agent");
const webOk = await waitFor(WEB_URL, "web");

if (!agentOk) console.warn("[jarvis] agent not healthy yet — UI can still open");
if (!webOk) {
  console.error("[jarvis] web UI failed to start — check .jarvis-web.log");
  shutdown();
}

await open(WEB_URL);
console.log(`[jarvis] online → ${WEB_URL}`);
console.log("[jarvis] Ctrl+C to stop agent + UI");
