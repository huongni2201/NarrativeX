import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const violations = [];
const explicitLazyFixtureBoundaries = new Set([
  "src/features/project-creation/Step4Results.tsx",
]);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function add(file, rule, detail) {
  violations.push(`${relative(file)} [${rule}] ${detail}`);
}

const files = await walk(srcRoot);
for (const file of files) {
  const source = await readFile(file, "utf8");
  const rel = relative(file);
  const staticImports = [...source.matchAll(/(?:import|export)\s+(?:type\s+)?[^;\n]*?from\s+["']([^"']+)["']/g)].map((match) => match[1]);

  if (rel.startsWith("src/shared/")) {
    for (const specifier of staticImports) {
      if (specifier.startsWith("@/store/") || specifier.startsWith("@/features/") || specifier.startsWith("@/app/")) {
        add(file, "shared-boundary", `shared infrastructure must not import ${specifier}`);
      }
    }
  }

  if (/src\/app\/.+\/page\.tsx?$/.test(rel) || rel === "src/app/page.tsx") {
    for (const specifier of staticImports) {
      if (/\/page$/.test(specifier) || /\/page\.(?:ts|tsx|js|jsx)$/.test(specifier)) {
        add(file, "route-page-import", `route files must not import another route page: ${specifier}`);
      }
    }
  }

  for (const specifier of staticImports) {
    if (
      specifier === "@/lib/mock-data" ||
      /@\/lib\/[^"']*-mock$/.test(specifier) ||
      /@\/lib\/production-mock$/.test(specifier)
    ) {
      const allowedDemo =
        /(?:Demo|\.stories|\.test|\.spec)\.(?:ts|tsx|js|jsx)$/.test(rel) ||
        explicitLazyFixtureBoundaries.has(rel);
      if (!allowedDemo) add(file, "fixture-import", `fixture must be lazy-loaded behind a demo/test boundary: ${specifier}`);
    }
  }
}

if (violations.length > 0) {
  console.error("Frontend architecture check failed:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Frontend architecture check passed (${files.length} source files scanned).`);
