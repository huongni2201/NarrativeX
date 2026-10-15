import { HashRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { ProjectWorkspaceRoute } from "../features/editor/ProjectWorkspaceRoute";
import { AccountScreen } from "../features/accounts/screens/AccountScreen";
import { ProjectsScreen } from "../features/projects/screens/ProjectsScreen";
import { SettingsScreen } from "../features/settings/screens/SettingsScreen";

export function DesktopRouter() {
  return (
    <HashRouter><Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<ProjectsScreen />} />
      <Route path="/account" element={<AccountScreen />} />
      <Route path="/settings" element={<SettingsScreen />} />
      <Route path="/projects/:projectId/settings" element={<ProjectSettingsRedirect />} />
      <Route path="/projects/:projectId/*" element={<ProjectWorkspaceRoute />} />
      <Route path="/characters" element={<Navigate to="/projects" replace />} />
      <Route path="/assets" element={<Navigate to="/projects" replace />} />
      <Route path="/generation/*" element={<Navigate to="/projects" replace />} />
      <Route path="/history" element={<Navigate to="/projects" replace />} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes></HashRouter>
  );
}

function ProjectSettingsRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  const returnTo = projectId ? `/projects/${projectId}/chapters` : "/projects";
  return <Navigate to={`/settings?returnTo=${encodeURIComponent(returnTo)}`} replace />;
}
