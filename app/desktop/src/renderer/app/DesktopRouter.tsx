import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { EditorScreen, type DesktopScreen } from "../features/editor/EditorScreen";
import { ProjectsScreen } from "../features/projects/screens/ProjectsScreen";

function ProjectWorkspaceRoute() {
  const location = useLocation();
  const path = location.pathname;
  const initialScreen: DesktopScreen = path.includes("/chapters")
    ? "chapters"
    : path.includes("/characters")
      ? "characters"
      : path.includes("/images")
        ? "images"
        : path.includes("/voice")
          ? "voice"
          : path.includes("/assets")
            ? "assets"
            : path.includes("/render")
              ? "render"
              : path.includes("/settings")
                ? "settings"
                : "editor";
  return <EditorScreen initialScreen={initialScreen} />;
}

export function DesktopRouter() {
  return (
    <HashRouter><Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<ProjectsScreen />} />
      <Route path="/projects/:projectId/*" element={<ProjectWorkspaceRoute />} />
      <Route path="/characters" element={<Navigate to="/projects" replace />} />
      <Route path="/assets" element={<Navigate to="/projects" replace />} />
      <Route path="/generation/*" element={<Navigate to="/projects" replace />} />
      <Route path="/history" element={<Navigate to="/projects" replace />} />
      <Route path="/settings" element={<Navigate to="/projects" replace />} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes></HashRouter>
  );
}
