# NarrativeX Local Agent

Phase 1 of the NarrativeX local execution node.

## Current scope

- Electron tray/background process
- one-time device pairing with NarrativeX Backend
- OS-encrypted device token storage using Electron `safeStorage`
- periodic REST heartbeat
- minimal local pairing/status window
- no Playwright/Gemini automation yet

## Local development

Start NarrativeX backend with the `local` profile and local dev identity enabled, then create a pairing code through:

```http
POST /api/v1/local-devices/pairing-codes
```

Run the agent:

```powershell
cd tools/local-agent
npm install
$env:NARRATIVEX_BACKEND_URL="http://localhost:8080"
npm run dev
```

Enter the returned `NX-XXXX-XXXX` code in the Agent window.

The Agent sends a heartbeat every 15 seconds by default. Override it for development with:

```powershell
$env:NARRATIVEX_AGENT_HEARTBEAT_MS="15000"
```

## Build Windows installer

```powershell
npm run dist:win
```

Output is written to `release/`.

## Security boundary

The backend never receives or stores Google/Gemini credentials in this phase. The NarrativeX device token is returned only during pairing, encrypted locally with OS-backed Electron `safeStorage`, and only its SHA-256 digest is persisted by the backend.

## Next phase

Add the Playwright browser manager and persistent Gemini browser profiles on top of the established device identity and heartbeat lifecycle.
