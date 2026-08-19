import { StudioAppShell } from "@/components/layout/StudioAppShell";

interface ProjectStoryboardPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectStoryboardPage({
  params,
}: Readonly<ProjectStoryboardPageProps>) {
  const { projectId } = await params;
  return <StudioAppShell screen="storyboard" projectId={projectId} />;
}
