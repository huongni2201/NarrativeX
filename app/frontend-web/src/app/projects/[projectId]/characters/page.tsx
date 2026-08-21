import { StudioAppShell } from "@/components/layout/StudioAppShell";

interface ProjectCharactersPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectCharactersPage({
  params,
}: Readonly<ProjectCharactersPageProps>) {
  const { projectId } = await params;
  return (
    <StudioAppShell
      screen="project-workspace"
      projectId={projectId}
      initialTab="characters"
    />
  );
}
