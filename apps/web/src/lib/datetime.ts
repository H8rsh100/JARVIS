/** Indian Standard Time (Asia/Kolkata, UTC+5:30) helpers */

const IST = "Asia/Kolkata";

export function nowInIST(date = new Date()) {
  const datePart = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  const timePart = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);

  return { datePart, timePart, zone: "IST (India Standard Time)" };
}

export function formatISTReply(kind: "time" | "date" | "both" = "both"): string {
  const { datePart, timePart, zone } = nowInIST();
  if (kind === "time") {
    return `It is ${timePart} ${zone}.`;
  }
  if (kind === "date") {
    return `Today is ${datePart}, ${zone}.`;
  }
  return `It is ${timePart} on ${datePart}, ${zone}.`;
}

/** Normalize STT / casual phrasing before matching. */
function normalizeQuestion(text: string): string {
  return text
    .replace(/\bjarvis\b/gi, " ")
    .replace(/[?.!,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Detect date / time questions (voice + typed). */
export function isDateTimeQuestion(text: string): "time" | "date" | "both" | null {
  const t = normalizeQuestion(text);
  if (!t) return null;

  const asksTime =
    /\b(what('?s| is)?\s+(the\s+)?time|what\s+time\s+is\s+it|current\s+time|time\s+now|tell\s+me\s+(the\s+)?time|give\s+me\s+(the\s+)?time|time\s+please)\b/i.test(
      t,
    ) || /^\s*time\s*$/i.test(t);

  const asksDate =
    /\b(what('?s| is)?\s+(the\s+)?(date|day)|what\s+day\s+is\s+it|current\s+date|today('?s)?\s+date|tell\s+me\s+(the\s+)?date|give\s+me\s+(the\s+)?date|date\s+please)\b/i.test(
      t,
    ) || /^\s*date\s*$/i.test(t);

  const asksBoth =
    /\b(date\s+and\s+time|time\s+and\s+date|what('?s| is)\s+(the\s+)?(date\s*\/\s*time|datetime))\b/i.test(
      t,
    ) ||
    (asksTime && asksDate);

  if (asksBoth) return "both";
  if (asksTime) return "time";
  if (asksDate) return "date";
  return null;
}
