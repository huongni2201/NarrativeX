export type ActivityId = "editor" | "chapters" | "characters" | "images" | "voice" | "assets" | "render" | "settings";
export type DesktopScreen = ActivityId | "projects";

const workspaceSegments: ReadonlyArray<readonly [string, ActivityId]> = [
  ["chapters", "chapters"],
  ["characters", "characters"],
  ["images", "images"],
  ["voice", "voice"],
  ["assets", "assets"],
  ["render", "render"],
  ["settings", "settings"],
];

export function screenFromWorkspacePath(pathname: string): ActivityId {
  const segments = pathname.split("/").filter(Boolean);
  const leaf = segments.at(-1) ?? "editor";
  return workspaceSegments.find(([segment]) => segment === leaf)?.[1] ?? "editor";
}
