/**
 * What JARVIS can and cannot do on the laptop.
 */

export const CAPABILITIES_BRIEF =
  "I can open scanned apps, folders, and URLs on this PC, manage windows and clipboard, plus camera in the UI. I do not have full PC control.";

export const CAPABILITIES_FULL = `Here is my scope on this laptop.

I can:
- Scan every installed app (Start Menu + Microsoft Store) and open it by name, with did-you-mean suggestions; PATH tools work too
- Open apps: Chrome, Edge, Cursor, VS Code, WhatsApp, Slack, Notion, Figma, Outlook, Spotify, Discord, Teams, and more
- Teach me nicknames: "when I say studio, open Android Studio", "list my aliases"
- Open files by name: "open report.pdf" opens it in its default program
- Open folders: Desktop, Downloads, Documents, Home, JARVIS project, today's Downloads, resume/CV search
- Open any named folder on this PC: "open the folder called projects in the C drive" finds and opens it
- Open sites and URLs
- Window control: focus, minimize, close (close asks confirm)
- Clipboard: read clipboard, "copy that" for my last reply
- Memory: your name, project path, favorites
- Wake hands-free with "Hey Jarvis" (guard mode); every command needs a tap on the mic
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
