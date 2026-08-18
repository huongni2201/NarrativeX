import { StudioAppShell } from "@/components/layout/StudioAppShell";

interface ChapterWorkspacePageProps {
  params: Promise<{ projectId: string; chapterId: string }>;
}

export default async function ChapterWorkspacePage({
  params,
}: Readonly<ChapterWorkspacePageProps>) {
  const { projectId, chapterId } = await params;
  return (
    <StudioAppShell
      screen="chapter-workspace"
      projectId={projectId}
      chapterId={chapterId}
    />
  );
}
