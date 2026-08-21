"use client";

import { use } from "react";
import { CharacterDetailView } from "@/features/characters/CharacterDetailView";

interface ProjectCharacterDetailPageProps {
  params: Promise<{ projectId: string; characterId: string }>;
}

export default function ProjectCharacterDetailPage({
  params,
}: Readonly<ProjectCharacterDetailPageProps>) {
  const resolvedParams = use(params);
  const projectId = Number(resolvedParams.projectId);
  const characterId = Number(resolvedParams.characterId);

  return (
    <div className="p-6">
      <CharacterDetailView characterId={characterId} projectId={projectId} />
    </div>
  );
}
