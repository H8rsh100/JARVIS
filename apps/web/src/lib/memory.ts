/** Lightweight personal memory in localStorage (name, project, favorites). */

const KEY = "jarvis.memory.v1";

export type JarvisMemory = {
  name?: string;
  projectPath?: string;
  favorites?: string[];
  /** Teachable open-aliases: "studio" -> "Android Studio" */
  aliases?: Record<string, string>;
};

export function loadMemory(): JarvisMemory {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as JarvisMemory;
    const aliases: Record<string, string> = {};
    if (parsed.aliases && typeof parsed.aliases === "object") {
      for (const [k, v] of Object.entries(parsed.aliases)) {
        if (typeof v === "string" && v.trim()) aliases[k] = v.trim();
      }
    }
    return {
      name: parsed.name?.trim() || undefined,
      projectPath: parsed.projectPath?.trim() || undefined,
      favorites: Array.isArray(parsed.favorites)
        ? parsed.favorites.map(String).slice(0, 20)
        : undefined,
      aliases: Object.keys(aliases).length ? aliases : undefined,
    };
  } catch {
    return {};
  }
}

export function saveMemory(patch: Partial<JarvisMemory>): JarvisMemory {
  const next = { ...loadMemory(), ...patch };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  }
  return next;
}

/** Parse memory commands. Returns reply text, or null if not a memory command. */
export function handleMemoryCommand(
  text: string,
): { reply: string; memory?: JarvisMemory; openPath?: string } | null {
  const t = text.trim();

  const nameSet = t.match(
    /\b(?:my name is|call me|i am|i'm)\s+([A-Za-z][A-Za-z .'-]{1,40})\s*$/i,
  );
  if (nameSet?.[1]) {
    const name = nameSet[1].replace(/[?.!]+$/, "").trim();
    const memory = saveMemory({ name });
    return { reply: `Understood. I'll call you ${name}.`, memory };
  }

  if (/\b(what('?s| is) my name|who am i|do you know (my )?name)\b/i.test(t)) {
    const memory = loadMemory();
    return {
      reply: memory.name
        ? `You are ${memory.name}, sir.`
        : "I do not have your name yet. Say: my name is Harsh.",
      memory,
    };
  }

  const proj = t.match(
    /\b(?:remember (?:my )?project(?: path)?(?: is)?|my project (?:path )?is|set project(?: to)?)\s+(.+)$/i,
  );
  if (proj?.[1]) {
    const projectPath = proj[1].replace(/^["']|["']$/g, "").trim();
    const memory = saveMemory({ projectPath });
    return {
      reply: `Project path saved: ${projectPath}`,
      memory,
    };
  }

  if (/\b(open|show)\s+(my\s+)?(saved\s+)?project\b/i.test(t)) {
    const memory = loadMemory();
    if (memory.projectPath) {
      return {
        reply: `Opening your project: ${memory.projectPath}`,
        memory,
        openPath: memory.projectPath,
      };
    }
    return {
      reply:
        "No saved project path. Say: remember my project is C:\\path\\to\\folder",
      memory,
    };
  }

  const aliasSet = t.match(
    /\bwhen i say\s+(.+?)\s*,?\s*(?:please\s+)?open\s+(.+?)\s*$/i,
  );
  if (aliasSet?.[1] && aliasSet?.[2]) {
    const say = aliasSet[1].replace(/^["']|["']$/g, "").trim().toLowerCase();
    const target = aliasSet[2].replace(/^["']|["']$/g, "").trim();
    if (say.length >= 2 && say.length < 60 && target.length >= 1 && target.length < 80) {
      const memory = loadMemory();
      const aliases = { ...(memory.aliases || {}), [say]: target };
      const next = saveMemory({ aliases });
      return {
        reply: `Got it. When you say "${say}", I'll open ${target}.`,
        memory: next,
      };
    }
  }

  const aliasForget = t.match(/\bforget alias\s+(.+?)\s*$/i);
  if (aliasForget?.[1]) {
    const say = aliasForget[1].replace(/^["']|["']$/g, "").trim().toLowerCase();
    const memory = loadMemory();
    if (memory.aliases?.[say]) {
      const aliases = { ...memory.aliases };
      delete aliases[say];
      const next = saveMemory({ aliases });
      return { reply: `Forgot the alias for "${say}".`, memory: next };
    }
    return { reply: `No alias saved for "${say}".`, memory };
  }

  if (/\b(list|show)\s+(my\s+)?aliases\b/i.test(t)) {
    const memory = loadMemory();
    const entries = Object.entries(memory.aliases || {});
    return {
      reply: entries.length
        ? `Aliases: ${entries.map(([k, v]) => `"${k}" opens ${v}`).join("; ")}`
        : 'No aliases yet. Say: when I say studio, open Android Studio',
      memory,
    };
  }

  const favAdd = t.match(
    /\b(?:remember|favorite|favourite|save)\s+(?:app\s+)?(.+?)(?:\s+as\s+favorite)?\s*$/i,
  );
  if (
    favAdd?.[1] &&
    /\b(remember|favorite|favourite|save)\b/i.test(t) &&
    !/\b(project|name|path)\b/i.test(t)
  ) {
    const app = favAdd[1].replace(/[?.!]+$/, "").trim();
    if (app.length >= 2 && app.length < 40) {
      const memory = loadMemory();
      const favorites = Array.from(
        new Set([...(memory.favorites || []), app]),
      ).slice(0, 20);
      const next = saveMemory({ favorites });
      return { reply: `Favorite saved: ${app}`, memory: next };
    }
  }

  if (/\b(list|show)\s+(my\s+)?favorites?\b/i.test(t)) {
    const memory = loadMemory();
    const favs = memory.favorites || [];
    return {
      reply: favs.length
        ? `Favorites: ${favs.join(", ")}`
        : "No favorites yet. Say: favorite Notion",
      memory,
    };
  }

  return null;
}
