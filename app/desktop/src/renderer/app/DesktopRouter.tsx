import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { EditorScreen, type DesktopScreen } from "../features/editor/EditorScreen";

const routeScreens: Array<{ path: string; screen: DesktopScreen }> = [
  { path: "/", screen: "editor" },
  { path: "/projects", screen: "projects" },
  { path: "/projects/:projectId", screen: "projects" },
  { path: "/projects/:projectId/editor", screen: "editor" },
  { path: "/projects/:projectId/chapters/:chapterId", screen: "chapters" },
  { path: "/characters", screen: "characters" },
  { path: "/assets", screen: "assets" },
  { path: "/generation/images", screen: "images" },
  { path: "/generation/tts", screen: "voice" },
  { path: "/history", screen: "projects" },
  { path: "/settings", screen: "settings" },
];

export function DesktopRouter() {
  return (
    <HashRouter>
      <Routes>
        {routeScreens.map(({ path, screen }) => (
          <Route key={path} path={path} element={<EditorScreen initialScreen={screen} />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
