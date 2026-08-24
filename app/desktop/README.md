# NarrativeX Desktop

Electron + React + TypeScript editor shell for the future primary NarrativeX client.

The current renderer is Phase UI-1: it provides the dark editor workspace, read-only API adapters for projects, production timeline, assets, characters, voices and style presets, plus a CSRF-protected production render request with generation-job polling. It does not silently fall back to mock runtime data; loading, empty and backend-error states are rendered explicitly. The preload bridge is intentionally narrow and keeps `contextIsolation: true`, `nodeIntegration: false`, and sandboxing enabled.

Run from this folder after installing dependencies:

```bash
npm install
npm run dev
```

Next integration phases should add editor mutations, cancellation/recovery actions and local FFmpeg orchestration using the existing production contracts. Timeline clips already consume `startMs` / `endMs`, with narration remaining the master clock. Final rendering belongs to the desktop FFmpeg execution engine, not the renderer.
