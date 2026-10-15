import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import test from "node:test";

const desktopRoot = resolve(dirname(import.meta.filename), "..");
const rendererRoot = join(desktopRoot, "src", "renderer");
const styles = readFileSync(join(rendererRoot, "styles.css"), "utf8");

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return extname(entry.name) === ".tsx" ? [path] : [];
  });
}

/** Declarations inside the first block that starts with `selector {`. */
function tokensOf(selector) {
  const start = styles.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} block is missing from styles.css`);
  const end = styles.indexOf("\n}\n", start);
  const tokens = new Map();
  for (const [, name, value] of styles.slice(start, end).matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gim)) {
    tokens.set(name, value.trim());
  }
  return tokens;
}

function themeTokens(overrides) {
  return new Map([...tokensOf(":root"), ...overrides]);
}

function resolveColor(tokens, name, seen = new Set()) {
  assert.ok(!seen.has(name), `circular token ${name}`);
  const value = tokens.get(name);
  assert.ok(value, `token ${name} is not declared`);
  const reference = value.match(/^var\((--[a-z0-9-]+)\)$/);
  if (reference) return resolveColor(tokens, reference[1], new Set([...seen, name]));
  assert.match(value, /^#[0-9a-f]{6}$/i, `${name} must resolve to an opaque hex colour, got ${value}`);
  return value;
}

function luminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themes = {
  dark: themeTokens(new Map()),
  light: themeTokens(tokensOf(':root[data-theme="light"]')),
};

const surfaces = ["--background", "--card", "--popover", "--secondary", "--surface-input", "--surface-panel", "--surface-dark"];
const readableText = ["--foreground", "--text-secondary", "--text-muted", "--text-dim"];
const statusText = ["--primary", "--destructive", "--success", "--warning", "--info", "--cyan", "--playhead"];

for (const [theme, tokens] of Object.entries(themes)) {
  test(`${theme} theme: text tokens meet WCAG AA 4.5:1 on every surface`, () => {
    const failures = [];
    for (const text of [...readableText, ...statusText]) {
      for (const surface of surfaces) {
        const ratio = contrast(resolveColor(tokens, text), resolveColor(tokens, surface));
        if (ratio < 4.5) failures.push(`${text} on ${surface} = ${ratio.toFixed(2)}`);
      }
    }
    assert.deepEqual(failures, []);
  });

  test(`${theme} theme: filled buttons keep readable label colour`, () => {
    const pairs = [
      ["--primary-foreground", "--primary"],
      ["--primary-foreground", "--primary-hover"],
      ["--destructive-foreground", "--destructive"],
    ];
    const failures = pairs
      .map(([fg, bg]) => [fg, bg, contrast(resolveColor(tokens, fg), resolveColor(tokens, bg))])
      .filter(([, , ratio]) => ratio < 4.5)
      .map(([fg, bg, ratio]) => `${fg} on ${bg} = ${ratio.toFixed(2)}`);
    assert.deepEqual(failures, []);
  });
}

test("no renderer text is set smaller than 12px", () => {
  const offenders = [];
  for (const file of sourceFiles(rendererRoot)) {
    const source = readFileSync(file, "utf8");
    for (const [, size] of source.matchAll(/\btext-\[(\d+(?:\.\d+)?)px\]/g)) {
      if (Number(size) < 12) offenders.push(`${file.replace(`${desktopRoot}/`, "")}: text-[${size}px]`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("bundled fonts exist and ship a Vietnamese subset for each family", () => {
  const faces = [...styles.matchAll(/@font-face\s*{([^}]+)}/g)].map(([, body]) => ({
    family: body.match(/font-family:\s*"([^"]+)"/)?.[1],
    file: body.match(/url\("\.\/([^"]+)"\)/)?.[1],
  }));
  assert.deepEqual([...new Set(faces.map((f) => f.family))].sort(), ["Be Vietnam Pro", "JetBrains Mono", "Literata"]);
  for (const { family, file } of faces) {
    assert.ok(existsSync(join(rendererRoot, file)), `${family}: ${file} is missing`);
  }
  for (const family of ["Be Vietnam Pro", "JetBrains Mono", "Literata"]) {
    assert.ok(
      faces.some((f) => f.family === family && f.file.includes("vietnamese")),
      `${family} needs a vietnamese subset`,
    );
  }
});

test("theme is applied before render and persisted outside React", () => {
  const main = readFileSync(join(rendererRoot, "main.tsx"), "utf8");
  assert.ok(main.indexOf("initTheme();") < main.indexOf("createRoot("), "initTheme must run before createRoot");
  const store = readFileSync(join(rendererRoot, "app", "ui-preferences.store.ts"), "utf8");
  assert.match(store, /persist\(/);
});
