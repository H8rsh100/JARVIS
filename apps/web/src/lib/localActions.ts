/**
 * Parse natural language into local laptop actions (fast path, no LLM needed).
 */

export type LocalAction = {
  kind: "open_app" | "open_url" | "open_path" | "shell" | "power";
  target: string;
  summary: string;
  risky?: boolean;
};

const APP_ALIASES: Array<{ keys: RegExp; target: string; label: string }> = [
  { keys: /\b(chrome|google chrome)\b/i, target: "chrome", label: "Chrome" },
  { keys: /\b(edge|microsoft edge)\b/i, target: "edge", label: "Edge" },
  { keys: /\b(vs\s*code|vscode|visual studio code)\b/i, target: "code", label: "VS Code" },
  { keys: /\bcursor\b/i, target: "cursor", label: "Cursor" },
  { keys: /\bnotepad\b/i, target: "notepad", label: "Notepad" },
  { keys: /\b(file explorer|explorer)\b/i, target: "explorer", label: "File Explorer" },
  { keys: /\b(terminal|windows terminal)\b/i, target: "terminal", label: "Windows Terminal" },
  { keys: /\bpowershell\b/i, target: "powershell", label: "PowerShell" },
  { keys: /\b(calc|calculator)\b/i, target: "calculator", label: "Calculator" },
  { keys: /\bspotify\b/i, target: "spotify", label: "Spotify" },
  { keys: /\bdiscord\b/i, target: "discord", label: "Discord" },
];

export function parseLocalAction(text: string): LocalAction | null {
  const t = text.trim();
  if (!t) return null;

  // Power: sleep / restart / shut down (PC) — not JARVIS standby
  if (
    /\b(shut\s*down|power\s*off|turn\s+off)\b/i.test(t) &&
    /\b(pc|computer|laptop|system|machine|windows)?\b/i.test(t)
  ) {
    return {
      kind: "power",
      target: "shutdown",
      summary: "Shut down this PC",
      risky: true,
    };
  }
  if (/\b(re(start|boot)|reboot)\b/i.test(t) && !/\bjarvis\b/i.test(t)) {
    return {
      kind: "power",
      target: "restart",
      summary: "Restart this PC",
      risky: true,
    };
  }
  if (
    /\b(hibernate)\b/i.test(t) ||
    /\b(put|send)\s+(the\s+)?(pc|computer|laptop|system|machine)\s+to\s+sleep\b/i.test(
      t,
    ) ||
    /\bsleep\s+(the\s+)?(pc|computer|laptop|system|machine)\b/i.test(t) ||
    /\b(pc|computer|laptop)\s+sleep\b/i.test(t)
  ) {
    const hibernate = /\bhibernate\b/i.test(t);
    return {
      kind: "power",
      target: hibernate ? "hibernate" : "sleep",
      summary: hibernate ? "Hibernate this PC" : "Sleep this PC",
      risky: true,
    };
  }

  // URLs
  const urlMatch = t.match(/https?:\/\/\S+/i);
  if (urlMatch && /\b(open|go to|launch|visit)\b/i.test(t)) {
    return {
      kind: "open_url",
      target: urlMatch[0],
      summary: `Open ${urlMatch[0]}`,
    };
  }
  if (/\b(open|go to)\s+(youtube|google|github|gmail)\b/i.test(t)) {
    const site = t.match(/\b(youtube|google|github|gmail)\b/i)?.[1]?.toLowerCase();
    const map: Record<string, string> = {
      youtube: "https://youtube.com",
      google: "https://google.com",
      github: "https://github.com",
      gmail: "https://mail.google.com",
    };
    if (site && map[site]) {
      return { kind: "open_url", target: map[site], summary: `Open ${site}` };
    }
  }
  if (/\b(open|start)\s+(localhost|local\s*host)(:\d+)?\b/i.test(t)) {
    const port = t.match(/:(\d{2,5})/)?.[1] || "3000";
    return {
      kind: "open_url",
      target: `http://localhost:${port}`,
      summary: `Open http://localhost:${port}`,
    };
  }

  // Folders
  if (/\b(open|show)\s+(my\s+)?(desktop|downloads|documents|home)\b/i.test(t)) {
    const folder = t.match(/\b(desktop|downloads|documents|home)\b/i)?.[1]?.toLowerCase() || "desktop";
    return {
      kind: "open_path",
      target: folder,
      summary: `Open ${folder}`,
    };
  }
  if (/\b(open|show)\s+(my\s+)?(jarvis|project)\b/i.test(t)) {
    return {
      kind: "open_path",
      target: "jarvis",
      summary: "Open JARVIS project folder",
    };
  }

  // Apps: "open chrome", "launch vscode", "start notepad"
  if (/\b(open|launch|start|run)\b/i.test(t)) {
    for (const app of APP_ALIASES) {
      if (app.keys.test(t)) {
        return {
          kind: "open_app",
          target: app.target,
          summary: `Open ${app.label}`,
        };
      }
    }
  }

  return null;
}

export const AGENT_URL =
  process.env.NEXT_PUBLIC_JARVIS_AGENT_URL || "http://127.0.0.1:3847";

export async function agentHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AGENT_URL}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function executeLocalAction(
  action: LocalAction,
  opts?: { confirm?: boolean },
): Promise<{ ok: boolean; did?: string; error?: string; needsConfirm?: boolean }> {
  const res = await fetch(`${AGENT_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: action.kind,
      target: action.target,
      confirm: opts?.confirm === true,
    }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    did?: string;
    error?: string;
    needsConfirm?: boolean;
  };
  return data;
}
