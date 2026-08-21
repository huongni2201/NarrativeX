"use client";

import { use } from "react";
import { CharacterDetailView } from "@/features/characters/CharacterDetailView";

interface GlobalCharacterDetailPageProps {
  params: Promise<{ characterId: string }>;
}

export default function GlobalCharacterDetailPage({
  params,
}: Readonly<GlobalCharacterDetailPageProps>) {
  const resolvedParams = use(params);
  const characterId = Number(resolvedParams.characterId);

  return (
    <div className="p-6">
      <CharacterDetailView characterId={characterId} />
    </div>
  );
}
