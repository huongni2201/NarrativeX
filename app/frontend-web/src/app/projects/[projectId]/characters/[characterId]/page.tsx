import { StudioAppShell } from "@/components/layout/StudioAppShell";

interface ProjectCharacterDetailPageProps {
  params: Promise<{ projectId: string; characterId: string }>;
}

export default async function ProjectCharacterDetailPage({
  params,
}: Readonly<ProjectCharacterDetailPageProps>) {
  const { projectId, characterId } = await params;
  return (
    <StudioAppShell
      screen="character-detail"
      projectId={projectId}
      characterId={characterId}
    />
  );
}
