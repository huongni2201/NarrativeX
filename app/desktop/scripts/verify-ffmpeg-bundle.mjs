import { access } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const suffix = process.platform === "win32" ? ".exe" : "";
const required = ["ffmpeg", "ffprobe"].map((name) => path.join(root, "resources", "ffmpeg", `${name}${suffix}`));

const missing = [];
for (const file of required) {
  try { await access(file); } catch { missing.push(file); }
}
if (missing.length) {
  console.error("NarrativeX packaging requires bundled FFmpeg binaries:");
  for (const file of missing) console.error(` - ${file}`);
  process.exit(1);
}
console.log("FFmpeg bundle verified.");
