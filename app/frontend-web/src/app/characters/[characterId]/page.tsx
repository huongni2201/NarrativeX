import { StudioAppShell } from "@/components/layout/StudioAppShell";

interface GlobalCharacterDetailPageProps {
  params: Promise<{ characterId: string }>;
}

export default async function GlobalCharacterDetailPage({
  params,
}: Readonly<GlobalCharacterDetailPageProps>) {
  const { characterId } = await params;
  return <StudioAppShell screen="character-detail" characterId={characterId} />;
}
