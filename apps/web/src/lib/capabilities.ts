/**
 * What JARVIS can and cannot do on the laptop.
 * Used by the UI fast-path and the LLM system prompt.
 */

export const CAPABILITIES_BRIEF =
  "I can open allowlisted apps, folders, and URLs on this PC through the local desktop agent, plus camera in the UI and optional wallet tools. I do not have full PC control.";

export const CAPABILITIES_FULL = `Here is my scope on this laptop.

I can:
- Open allowlisted apps: Chrome, Edge, VS Code, Cursor, Notepad, Explorer, Terminal, PowerShell, Calculator, Spotify, Discord
- Open folders: Desktop, Downloads, Documents, Home, and the JARVIS project
- Open sites and URLs: YouTube, Google, GitHub, Gmail, localhost, or any http link
- Open or close the camera in this UI
- Put the PC to sleep, hibernate, restart, or shut down (asks you to confirm first)
- Tell the current date and time in Indian Standard Time (IST)
- I run in my own desktop window. Opening Chrome opens a separate browser for you.
- Chat after you wake me with Hello Jarvis
- Optionally help with wallet and testnet Web3 tools if connected

I cannot:
- Full PC control
- Arbitrary file reads or writes
- Mouse or keyboard takeover
- Silent system settings changes
- Run random shell commands from chat without an explicit confirm path; the agent deny-lists dangerous patterns

Safety: the desktop agent only listens on 127.0.0.1 and only runs allowlisted actions.`;

export const CAPABILITIES_SPOKEN =
  "I can open allowlisted apps, folders, and URLs on this PC. I do not have full control: no arbitrary files, no mouse takeover, no silent system changes, and no unchecked shell.";

/** True when the user is asking what JARVIS can / cannot do. */
export function isCapabilitiesQuestion(text: string): boolean {
  const t = text.trim();
  // bare "help" only — not "help me open chrome"
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
