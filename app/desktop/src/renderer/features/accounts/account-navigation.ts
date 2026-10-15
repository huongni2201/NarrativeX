const PROJECTS_PATH = "/projects";
const WORKSPACE_SEGMENTS = new Set([
  "chapters",
  "canon",
  "editor",
  "assets",
  "jobs",
  "render",
]);

export function accountHrefFrom(returnTo: string): string {
  const safeReturnTo = isAllowedReturnPath(returnTo) ? returnTo : PROJECTS_PATH;
  return `/account?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function applicationReturnPath(search: string): string {
  const returnTo = new URLSearchParams(search).get("returnTo");
  return returnTo && isAllowedReturnPath(returnTo) ? returnTo : PROJECTS_PATH;
}

function isAllowedReturnPath(value: string): boolean {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("#") ||
    /[\u0000-\u001f]/.test(value)
  ) {
    return false;
  }

  const path = value.split("?", 1)[0];
  if (path === "/settings") return true;
  const segments = path.split("/");
  if (segments[0] !== "" || segments[1] !== "projects") return false;
  if (segments.length === 2) return true;
  if (segments.length < 3 || !/^[A-Za-z0-9_-]+$/.test(segments[2])) return false;
  if (segments.length === 3) return true;
  if (!WORKSPACE_SEGMENTS.has(segments[3])) return false;

  return segments.slice(4).every(
    (segment) => segment !== "" && segment !== "." && segment !== ".." && /^[A-Za-z0-9._~-]+$/.test(segment),
  );
}
