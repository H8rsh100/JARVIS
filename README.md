# JARVIS

Voice laptop assistant with a Stark-style UI. Say **Hello Jarvis**, then tell it what to open on your Windows PC.

## What it does (demo story)

1. Wake: `Hello Jarvis` → *Hello sir, ready to assist*
2. `Open Chrome` / `Open VS Code` / `Open Cursor` → launches on your machine
3. `Open my project` → opens `C:\PROJECTS\JARVIS` in Explorer
4. `Open YouTube` / `Open localhost:3000` → opens in browser
5. `Open camera` → webcam in the UI

Optional: crypto tools still exist in the stack, but the **hiring demo** is local control.

## Run (2 terminals)

```powershell
cd C:\PROJECTS\JARVIS
pnpm install
```

**Terminal A – desktop agent (required for laptop actions):**
```powershell
pnpm agent
```
You should see: `JARVIS desktop agent on http://127.0.0.1:3847`

**Terminal B – UI:**
```powershell
pnpm --filter @jarvis/web dev
```
Open the URL Next prints (usually http://localhost:3000).

In `apps/web/.env.local`:
```env
GOOGLE_GENERATIVE_AI_API_KEY=your_ai_studio_key
```

## 90-second demo script

1. Refresh page, say/type: **Hello Jarvis**
2. **Open Chrome**
3. **Open VS Code** (or **Open Cursor**)
4. **Open my project**
5. **Open camera**

## Safety

- Agent only listens on `127.0.0.1` (this PC only)
- Shell commands need explicit confirm and a deny-list for dangerous patterns
- Browser still cannot control your PC alone; the **desktop agent** is what executes actions

## Layout

```
apps/web             Next.js UI + voice
apps/desktop-agent   Local Windows action runner
packages/agent       Optional Web3 tool helpers
packages/chains      Chain configs
contracts            Sample Solidity
```
