import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { accountHrefFrom, applicationReturnPath } from "../src/renderer/features/accounts/account-navigation.ts";

const desktopSource = resolve(dirname(fileURLToPath(import.meta.url)), "../src/renderer");

test("application links preserve a chapter workspace and its stage across refresh", () => {
  const href = accountHrefFrom("/projects/project-123/chapters?stage=source");

  assert.equal(
    href,
    "/account?returnTo=%2Fprojects%2Fproject-123%2Fchapters%3Fstage%3Dsource",
  );
  assert.equal(
    applicationReturnPath("?returnTo=%2Fprojects%2Fproject-123%2Fchapters%3Fstage%3Dsource"),
    "/projects/project-123/chapters?stage=source",
  );
});

test("application return path supports Settings and rejects external or unsupported routes", () => {
  assert.equal(accountHrefFrom("https://example.com"), "/account?returnTo=%2Fprojects");
  assert.equal(accountHrefFrom("/settings"), "/account?returnTo=%2Fsettings");
  assert.equal(applicationReturnPath("?returnTo=%2Fsettings"), "/settings");
  assert.equal(applicationReturnPath("?returnTo=%2F%2Fevil.example"), "/projects");
  assert.equal(applicationReturnPath("?returnTo=%2Fprojects%2Fabc%2Funknown"), "/projects");
  assert.equal(applicationReturnPath("?returnTo=%2Fprojects%2F..%2Fsettings"), "/projects");
});

test("Account and Settings are application-scoped and reachable without a project", () => {
  const router = readFileSync(resolve(desktopSource, "app/DesktopRouter.tsx"), "utf8");
  const projects = readFileSync(resolve(desktopSource, "features/projects/screens/ProjectsScreen.tsx"), "utf8");
  const workspace = readFileSync(resolve(desktopSource, "features/workspace/components/WorkspaceShell.tsx"), "utf8");

  assert.match(router, /path="\/account"/);
  assert.match(router, /path="\/settings"/);
  assert.match(router, /path="\/projects\/:projectId\/settings"/);
  assert.equal((projects.match(/actions=\{applicationActions\}/g) ?? []).length, 2);
  assert.match(projects, /navigate\("\/settings\?returnTo=%2Fprojects"\)/);
  assert.doesNotMatch(workspace, /aria-label="Account"/);
  assert.doesNotMatch(workspace, /accountHrefFrom\(/);
  assert.doesNotMatch(workspace, /id: "settings"/);
});
