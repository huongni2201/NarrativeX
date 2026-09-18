export type ActivityId =
  | "chapters"
  | "canon"
  | "editor"
  | "assets"
  | "jobs"
  | "settings"
  | "storyboard"
  | "characters"
  | "images"
  | "voice"
  | "render";

export type DesktopScreen = ActivityId | "projects";

const workspaceSegments: ReadonlyArray<readonly [string, ActivityId]> = [
  ["editor", "editor"],
  ["chapters", "chapters"],
  ["canon", "canon"],
  ["storyboard", "storyboard"],
  ["characters", "characters"],
  ["images", "images"],
  ["voice", "voice"],
  ["assets", "assets"],
  ["jobs", "jobs"],
  ["render", "render"],
  ["settings", "settings"],
];

export function screenFromWorkspacePath(pathname: string): ActivityId {
  const segments = pathname.split("/").filter(Boolean);
  const leaf = segments.at(-1) ?? "chapters";
  return workspaceSegments.find(([segment]) => segment === leaf)?.[1] ?? "chapters";
}
