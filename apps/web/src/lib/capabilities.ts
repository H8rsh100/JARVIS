/**
 * What JARVIS can and cannot do on the laptop.
 */

export const CAPABILITIES_BRIEF =
  "I can open scanned apps, folders, and URLs on this PC, manage windows and clipboard, plus camera in the UI. I do not have full PC control.";

export const CAPABILITIES_FULL = `Here is my scope on this laptop.

I can:
- Scan installed Start Menu apps and open them by name (aliases + fuzzy match)
- Open apps: Chrome, Edge, Cursor, VS Code, WhatsApp, Slack, Notion, Figma, Outlook, Spotify, Discord, Teams, and more
- Open folders: Desktop, Downloads, Documents, Home, JARVIS project, today's Downloads, resume/CV search
- Open sites and URLs
- Window control: focus, minimize, close (close asks confirm)
- Clipboard: read clipboard, "copy that" for my last reply
- Memory: your name, project path, favorites
- Stay hot ~45s after wake for continuous commands
- Camera in this UI; IST date/time; power sleep/restart/shutdown with confirm
- JARVIS runs in its own Chrome app window; "Open Chrome" opens your normal browser

I cannot:
- Full PC control
- Arbitrary file writes
- Mouse or keyboard takeover
- Silent system settings changes
- Unchecked shell

Safety: agent only on 127.0.0.1; risky actions need confirm.`;

export const CAPABILITIES_SPOKEN =
  "I can scan and open apps on this PC, manage folders, windows, and clipboard, and stay listening after wake. I do not have full system control.";

export function isCapabilitiesQuestion(text: string): boolean {
  const t = text.trim();
  if (/^\s*help\s*[!?.]?\s*$/i.test(t)) return true;
  return (
    /\bwhat can you (do|access|control)\b/i.test(t) ||
    /\b(your|jarvis['']?s?) (capabilities|limits|permissions|access)\b/i.test(t) ||
    /\bcan you (control|access|take over) (my )?(pc|computer|laptop|system|files|everything)\b/i.test(
      t,
    ) ||
    /\b(full (pc|computer|laptop|system) control)\b/i.test(t) ||
    /\bwhat (are your limits|can't you do|cannot you do)\b/i.test(t) ||
    /\bwhat do you (support|offer)\b/i.test(t)
  );
}
