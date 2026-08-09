# JARVIS

Voice laptop assistant with a Stark-style UI. Say **Hello Jarvis**, then tell it what to open on your Windows PC.

## Your daily flow (what you asked for)

1. Open laptop  
2. Open **CMD**  
3. Run:

```bat
cd C:\PROJECTS\JARVIS
jarvis.cmd
```

Or:

```bat
cd C:\PROJECTS\JARVIS
pnpm jarvis
```

4. Wait for the **Chrome app window** (looks like a desktop app, not a normal browser tab)  
5. Tap mic → say **Hello Jarvis** → give commands  
6. Tray icon stays in the notification area (`Ctrl+Shift+J` re-opens the window)  
7. Quit from the tray when done  

Keep the CMD window open while JARVIS is running.

### Why not a pure Electron mic window?

Electron cannot use Chrome’s Web Speech engine (fake “network” / key errors).  
So the host keeps the **tray + agent** in Electron, and opens a **Chrome `--app=` window** for the UI. Voice then works **exactly like Chrome**, which is what you already verified.

## What it does (demo story)

1. Wake: `Hello Jarvis` → *Hello sir, ready to assist*  
2. `Open Chrome` / `Open VS Code` / `Open Cursor` → launches on your machine  
3. `Open my project` → opens `C:\PROJECTS\JARVIS` in Explorer  
4. `Open YouTube` / `Open localhost:3000` → opens in browser  
5. `Open camera` → webcam in the UI  

Ask **what can you do** for the full can / cannot list.

## Setup (once)

```powershell
cd C:\PROJECTS\JARVIS
pnpm install
```

In `apps/web/.env.local`:

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_ai_studio_key
```

## 90-second demo script

1. `jarvis.cmd` → wait for app window  
2. **Hello Jarvis**  
3. **Open Chrome**  
4. **Open VS Code** (or **Open Cursor**)  
5. **Open my project**  
6. **Open camera**  

## Safety

- Agent only listens on `127.0.0.1` (this PC only)  
- Shell commands need explicit confirm and a deny-list for dangerous patterns  
- Browser still cannot control your PC alone; the **desktop agent** executes actions  

## Layout

```
jarvis.cmd           One-command CMD launcher
apps/web             Next.js UI + voice
apps/desktop-agent   Local Windows action runner
apps/host            Tray + boots agent/web + opens Chrome app window
packages/agent       Optional Web3 tool helpers
packages/chains      Chain configs
contracts            Sample Solidity
```
