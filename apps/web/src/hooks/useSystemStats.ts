"use client";

import { useCallback, useEffect, useState } from "react";

export interface SystemStats {
  cpu: number;        // 0-100 %
  ram: number;        // 0-100 %
  battery: number | null; // 0-100 % or null (desktop)
  memUsedGB: string;  // e.g. "7.2"
  memTotalGB: string; // e.g. "16.0"
  ping: number | null; // ms or null
  uptimeH: number;
  uptimeM: number;
  ip: string;
  online: boolean;
  loaded: boolean;    // false until first successful fetch
}

const DEFAULTS: SystemStats = {
  cpu: 0,
  ram: 0,
  battery: null,
  memUsedGB: "0.0",
  memTotalGB: "0.0",
  ping: null,
  uptimeH: 0,
  uptimeM: 0,
  ip: "...",
  online: false,
  loaded: false,
};

export function useSystemStats(intervalMs = 4000): SystemStats {
  const [stats, setStats] = useState<SystemStats>(DEFAULTS);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/system-stats", { cache: "no-store" });
      if (!res.ok) return;
      const d = (await res.json()) as Partial<SystemStats> & {
        uptimeH?: number;
        uptimeM?: number;
      };
      setStats({
        cpu: d.cpu ?? 0,
        ram: d.ram ?? 0,
        battery: d.battery ?? null,
        memUsedGB: d.memUsedGB ?? "0.0",
        memTotalGB: d.memTotalGB ?? "0.0",
        ping: d.ping ?? null,
        uptimeH: d.uptimeH ?? 0,
        uptimeM: d.uptimeM ?? 0,
        ip: d.ip ?? "...",
        online: d.online ?? false,
        loaded: true,
      });
    } catch {
      /* silently keep last known values */
    }
  }, []);

  useEffect(() => {
    void poll();
    const id = setInterval(() => void poll(), intervalMs);
    return () => clearInterval(id);
  }, [poll, intervalMs]);

  return stats;
}
