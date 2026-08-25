import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProjectWorkspaceRoute } from "../features/editor/ProjectWorkspaceRoute";
import { ProjectsScreen } from "../features/projects/screens/ProjectsScreen";

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
