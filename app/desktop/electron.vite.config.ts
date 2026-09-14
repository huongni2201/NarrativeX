import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Electron/Windows can briefly keep generated chunks open while the app is
  // running. Avoid Vite's per-target cleanup step, which otherwise fails with
  // EPERM when it tries to remove a locked chunk from the shared output tree.
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { emptyOutDir: false },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { emptyOutDir: false },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src/renderer"),
      },
    },
    build: {
      emptyOutDir: false,
    },
  },
});
