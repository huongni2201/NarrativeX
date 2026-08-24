import { StudioAppShell } from "@/components/layout/StudioAppShell";

interface ProjectProductionPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectProductionPage({
  params,
}: Readonly<ProjectProductionPageProps>) {
  const { projectId } = await params;
  return <StudioAppShell screen="production-timeline" projectId={projectId} />;
}
