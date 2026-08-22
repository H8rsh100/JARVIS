import { NextResponse } from "next/server";
import os from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sample CPU load over 100 ms using os.cpus() diff */
function getCpuLoad(): Promise<number> {
  return new Promise((resolve) => {
    const before = os.cpus();
    setTimeout(() => {
      const after = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      for (let i = 0; i < before.length; i++) {
        const b = before[i].times;
        const a = after[i].times;
        const idleDiff = a.idle - b.idle;
        const totalBefore = (Object.values(b) as number[]).reduce((x, y) => x + y, 0);
        const totalAfter = (Object.values(a) as number[]).reduce((x, y) => x + y, 0);
        totalIdle += idleDiff;
        totalTick += totalAfter - totalBefore;
      }
      const pct = totalTick > 0 ? Math.round(100 - (100 * totalIdle) / totalTick) : 0;
      resolve(Math.min(100, Math.max(0, pct)));
    }, 100);
  });
}

/** First non-internal IPv4 address */
function getLocalIp(): string {
  const ifaces = os.networkInterfaces();
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const addr of list) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return "127.0.0.1";
}

/** Measure round-trip to Google's 204 endpoint; 2 s timeout */
async function getPing(): Promise<number | null> {
  try {
    const t = Date.now();
    await fetch("https://www.google.com/generate_204", {
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    return Date.now() - t;
  } catch {
    return null;
  }
}

/** Battery % via systeminformation — gracefully returns null on desktops */
async function getBattery(): Promise<number | null> {
  try {
    // dynamic import so it never crashes if the package is absent
    const si = await import("systeminformation");
    const bat = await si.battery();
    if (bat.hasBattery && typeof bat.percent === "number") {
      return Math.round(bat.percent);
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    // Run slow operations in parallel
    const [cpu, ping, battery] = await Promise.all([
      getCpuLoad(),
      getPing(),
      getBattery(),
    ]);

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ram = Math.round((usedMem / totalMem) * 100);
    const memUsedGB = (usedMem / 1024 ** 3).toFixed(1);
    const memTotalGB = (totalMem / 1024 ** 3).toFixed(1);

    const uptimeSec = os.uptime();
    const uptimeH = Math.floor(uptimeSec / 3600);
    const uptimeM = Math.floor((uptimeSec % 3600) / 60);

    return NextResponse.json({
      cpu,
      ram,
      battery,
      memUsedGB,
      memTotalGB,
      ping,
      uptimeH,
      uptimeM,
      ip: getLocalIp(),
      online: ping !== null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "stats error" },
      { status: 500 },
    );
  }
}
