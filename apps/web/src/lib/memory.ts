/** Lightweight personal memory in localStorage (name, project, favorites). */

const KEY = "jarvis.memory.v1";

export type JarvisMemory = {
  name?: string;
  projectPath?: string;
  favorites?: string[];
};

export function loadMemory(): JarvisMemory {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as JarvisMemory;
    return {
      name: parsed.name?.trim() || undefined,
      projectPath: parsed.projectPath?.trim() || undefined,
      favorites: Array.isArray(parsed.favorites)
        ? parsed.favorites.map(String).slice(0, 20)
        : undefined,
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
