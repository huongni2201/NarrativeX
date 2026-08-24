# NarrativeX Desktop

Electron + React + TypeScript editor shell for the future primary NarrativeX client.

The current renderer is the first desktop workspace slice: it provides an editor/timeline shell with eight workspaces (Editor, Chapters, Characters, Image Generation, Voice & TTS, Assets, Render and Settings), read-only API adapters for production data, plus a CSRF-protected production render request with generation-job polling. The shell keeps project switching in the header, contextual navigation in the left rail, and inspector/job state in the right panel. It does not silently fall back to mock runtime data; loading, empty and backend-error states are rendered explicitly. The preload bridge is intentionally narrow and keeps `contextIsolation: true`, `nodeIntegration: false`, and sandboxing enabled.

Run from this folder after installing dependencies:

```bash
npm install
npm run dev
```

Next integration phases should add editor mutations, cancellation/recovery actions and local FFmpeg orchestration using the existing production contracts. Timeline clips already consume `startMs` / `endMs`, with narration remaining the master clock. Final rendering belongs to the desktop FFmpeg execution engine, not the renderer.
