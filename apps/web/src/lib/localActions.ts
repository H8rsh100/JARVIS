/**
 * Parse natural language into local laptop actions (fast path, no LLM needed).
 */

export type LocalAction = {
  kind:
    | "open_app"
    | "open_url"
    | "open_path"
    | "shell"
    | "power"
    | "scan_apps"
    | "window"
    | "clipboard_get"
    | "clipboard_set"
    | "file_search";
  target: string;
  summary: string;
  risky?: boolean;
  /** Extra payload (window title, clipboard text, etc.) */
  text?: string;
};

const APP_ALIASES: Array<{ keys: RegExp; target: string; label: string }> = [
  { keys: /\b(chrome|google chrome)\b/i, target: "chrome", label: "Chrome browser" },
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
  { keys: /\bwhatsapp\b/i, target: "whatsapp", label: "WhatsApp" },
  { keys: /\bslack\b/i, target: "slack", label: "Slack" },
  { keys: /\bnotion\b/i, target: "notion", label: "Notion" },
  { keys: /\bfigma\b/i, target: "figma", label: "Figma" },
  { keys: /\boutlook\b/i, target: "outlook", label: "Outlook" },
  { keys: /\b(teams|microsoft teams)\b/i, target: "teams", label: "Teams" },
  { keys: /\bsteam\b/i, target: "steam", label: "Steam" },
  { keys: /\b(excel|microsoft excel)\b/i, target: "excel", label: "Excel" },
  { keys: /\b(word|microsoft word)\b/i, target: "word", label: "Word" },
];

const SKIP_OPEN_GENERIC =
  /\b(camera|youtube|google|github|gmail|localhost|desktop|downloads|documents|home|jarvis|project|resume|clipboard|window)\b/i;

export function parseLocalAction(text: string): LocalAction | null {
  const t = text.trim();
  if (!t) return null;

  // File search
  const folderSearchMatch = t.match(
    /\b(?:is there any folder called|do I have a\s+(?:projects?\s+)?(?:folder|directory)(?:\s+(?:named|called))?|find\s+(?:folder|directory)(?:\s+(?:named|called))?)\s+['"]?([a-z0-9\s_-]+?)['"?.!\s]*$/i
  );
  if (folderSearchMatch?.[1]) {
    const name = folderSearchMatch[1].trim();
    return {
      kind: "file_search",
      target: "directory",
      text: name,
      summary: `Search for project folder: ${name}`,
    };
  }

  const recentFilesMatch = t.match(
    /\b(?:locate|find|search for|list|track)\s+recent\s+([a-z0-9_*-]+)(?:\s+files)?/i
  );
  if (recentFilesMatch?.[1]) {
    const ext = recentFilesMatch[1].trim().toLowerCase();
    return {
      kind: "file_search",
      target: "recent",
      text: ext,
      summary: `Locate recent ${ext.toUpperCase()} files`,
    };
  }

  const fileSearchMatch = t.match(
    /\b(?:locate|find|search for|search)\s+([a-z0-9_*.-]+\.[a-z0-9_*.-]+)\b/i
  );
  if (fileSearchMatch?.[1]) {
    const name = fileSearchMatch[1].trim();
    return {
      kind: "file_search",
      target: "file",
      text: name,
      summary: `Search for file: ${name}`,
    };
  }

  // Scan / index apps
  if (
    /\b(scan|index|refresh|list)\b.*\b(apps|applications|programs)\b/i.test(t) ||
    /\b(apps|applications|programs)\b.*\b(scan|index|refresh|list)\b/i.test(t) ||
    /\bwhat apps (do you|can you) (see|open|know)\b/i.test(t)
  ) {
    return {
      kind: "scan_apps",
      target: "scan",
      summary: "Scan installed apps",
    };
  }

  // Clipboard
  if (
    /\b(what('?s| is) on (the )?clipboard|read (the )?clipboard|paste from clipboard|show clipboard)\b/i.test(
      t,
    )
  ) {
    return {
      kind: "clipboard_get",
      target: "clipboard",
      summary: "Read clipboard",
    };
  }
  const copyMatch = t.match(
    /\b(?:copy that|copy this|copy to clipboard|set clipboard(?: to)?)\s*[:=]?\s*(.+)$/i,
  );
  if (copyMatch?.[1]) {
    return {
      kind: "clipboard_set",
      target: "clipboard",
      text: copyMatch[1].trim(),
      summary: "Copy to clipboard",
    };
  }
  if (/^\s*copy that\s*$/i.test(t)) {
    return {
      kind: "clipboard_set",
      target: "last_reply",
      summary: "Copy last reply to clipboard",
    };
  }

  // Window control
  const winClose = t.match(
    /\b(close|minimize|focus|bring(?:\s+up)?|show)\s+(?:the\s+)?(.+?)(?:\s+window)?\s*$/i,
  );
  if (
    winClose &&
    /\b(close|minimize|focus|bring|show)\b/i.test(winClose[1]) &&
    !/\b(camera|jarvis)\b/i.test(winClose[2]) &&
    !/\b(pc|computer|laptop|system)\b/i.test(winClose[2])
  ) {
    const verb = winClose[1].toLowerCase();
    const action = verb.startsWith("close")
      ? "close"
      : verb.startsWith("min")
        ? "minimize"
        : "focus";
    const title = winClose[2].replace(/\bapp\b/gi, "").trim();
    if (title.length >= 2 && !SKIP_OPEN_GENERIC.test(title)) {
      return {
        kind: "window",
        target: action,
        text: title,
        summary: `${action[0].toUpperCase()}${action.slice(1)} ${title}`,
        risky: action === "close",
      };
    }
  }

  // Power
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

  // Smart folders
  if (
    /\b(open|show)\s+(my\s+)?(downloads?\s+from\s+today|today'?s\s+downloads?)\b/i.test(
      t,
    )
  ) {
    return {
      kind: "open_path",
      target: "downloads_today",
      summary: "Open today's Downloads",
    };
  }
  if (/\b(open|show|find)\s+(my\s+)?(resume|cv)\b/i.test(t)) {
    return {
      kind: "open_path",
      target: "resume",
      summary: "Find and open resume",
    };
  }

  // Folders
  if (/\b(open|show)\s+(my\s+)?(desktop|downloads|documents|home)\b/i.test(t)) {
    const folder =
      t.match(/\b(desktop|downloads|documents|home)\b/i)?.[1]?.toLowerCase() ||
      "desktop";
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

  // Known app aliases
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

    // Generic: open <anything else> → agent fuzzy-matches scanned apps
    const generic = t.match(
      /^\s*(?:please\s+)?(?:open|launch|start|run)\s+(?:the\s+)?(.+?)\s*$/i,
    );
    if (generic?.[1] && !SKIP_OPEN_GENERIC.test(generic[1])) {
      const name = generic[1].replace(/[?.!]+$/, "").trim();
      if (name.length >= 2 && name.length < 60) {
        return {
          kind: "open_app",
          target: name,
          summary: `Open ${name}`,
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
): Promise<{
  ok: boolean;
  did?: string;
  error?: string;
  needsConfirm?: boolean;
  text?: string;
  count?: number;
}> {
  const res = await fetch(`${AGENT_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: action.kind,
      target: action.target,
      text: action.text,
      confirm: opts?.confirm === true,
    }),
  });
  const data = (await res.json()) as {
    ok: boolean;
    did?: string;
    error?: string;
    needsConfirm?: boolean;
    text?: string;
    count?: number;
  };
  return data;
}
