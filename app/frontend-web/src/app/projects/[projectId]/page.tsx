import { StudioAppShell } from "@/components/layout/StudioAppShell";

interface ProjectWorkspacePageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectWorkspacePage({ params }: Readonly<ProjectWorkspacePageProps>) {
  const { projectId } = await params;
  return <StudioAppShell screen="project-workspace" projectId={projectId} />;
}
