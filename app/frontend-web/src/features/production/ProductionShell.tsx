"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { chaptersApi } from "@/features/chapters/api/chapters.api";
import { projectsApi } from "@/features/projects/api/projects.api";
import { ApiClientError, apiErrorMessage } from "@/shared/api/client";
import { queryKeys } from "@/lib/query-keys";

interface ProductionShellProps {
  projectId?: string;
}

export function ProductionShell({ projectId }: Readonly<ProductionShellProps>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const numericProjectId = projectId ? Number(projectId) : Number.NaN;
  const hasValidProjectId = Number.isSafeInteger(numericProjectId) && numericProjectId > 0;
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const projectQuery = useQuery({
    queryKey: hasValidProjectId ? queryKeys.project(numericProjectId) : ["projects", "invalid"],
    queryFn: () => projectsApi.getById(numericProjectId),
    enabled: hasValidProjectId,
  });

  const storyQuery = useQuery({
    queryKey: hasValidProjectId ? queryKeys.story(numericProjectId) : ["stories", "invalid"],
    queryFn: async () => {
      try {
        return await projectsApi.getLatestStoryVersion(numericProjectId);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: hasValidProjectId,
  });

  const storyVersionId = storyQuery.data?.id;
  const chaptersQuery = useQuery({
    queryKey: storyVersionId
      ? queryKeys.chapters(numericProjectId, storyVersionId)
      : ["projects", numericProjectId, "chapters", "empty"],
    queryFn: () => chaptersApi.list(numericProjectId, storyVersionId!),
    enabled: Boolean(storyVersionId),
  });

  const createChapter = useMutation({
    mutationFn: async () => {
      const normalizedTitle = title.trim();
      if (!normalizedTitle || !sourceText.trim()) {
        throw new Error("Nhập tiêu đề và nội dung Chapter.");
      }

      let storyVersion = storyQuery.data;
      if (!storyVersion) {
        const project = projectQuery.data;
        if (!project) throw new Error("Project chưa sẵn sàng.");
        storyVersion = await projectsApi.createStoryVersion(numericProjectId, {
          content: sourceText,
          sourceLanguage: project.sourceLanguage,
        });
        queryClient.setQueryData(queryKeys.story(numericProjectId), storyVersion);
      }

      const chapters = chaptersQuery.data ?? [];
      const nextOrder =
        chapters.length === 0
          ? 0
          : Math.max(...chapters.map((chapter) => chapter.orderIndex)) + 1;
      return chaptersApi.create(numericProjectId, {
        storyVersionId: storyVersion.id,
        orderIndex: nextOrder,
        title: normalizedTitle,
        sourceText,
      });
    },
    onSuccess: (chapter) => {
      setFormError(null);
      setFormOpen(false);
      setTitle("");
      setSourceText("");
      queryClient.setQueryData(queryKeys.chapter(numericProjectId, chapter.id), chapter);
      void queryClient.invalidateQueries({ queryKey: queryKeys.story(numericProjectId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.chapters(numericProjectId, chapter.storyVersionId),
      });
      router.push(`/projects/${numericProjectId}/chapters/${chapter.id}`);
    },
    onError: (error) => setFormError(apiErrorMessage(error, "Không thể tạo Chapter.")),
  });

  if (!projectId)
    return <WorkspaceMessage>Chọn một project từ danh sách dự án để mở workspace.</WorkspaceMessage>;
  if (!hasValidProjectId) return <WorkspaceMessage>Project ID không hợp lệ.</WorkspaceMessage>;
  if (projectQuery.isPending)
    return <WorkspaceMessage>Đang tải project từ backend…</WorkspaceMessage>;
  if (projectQuery.isError)
    return (
      <WorkspaceError
        error={projectQuery.error}
        fallback="Không tải được project từ backend."
      />
    );
  if (storyQuery.isPending) return <WorkspaceMessage>Đang tải Story Version…</WorkspaceMessage>;
  if (storyQuery.isError)
    return <WorkspaceError error={storyQuery.error} fallback="Không tải được Story Version." />;
  if (chaptersQuery.isError)
    return (
      <WorkspaceError
        error={chaptersQuery.error}
        fallback="Không tải được danh sách Chapter."
      />
    );

  const project = projectQuery.data;
  const chapters = chaptersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800/80 bg-[#0d1420]/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-purple-300">Project workspace</p>
            <h2 className="mt-2 text-2xl font-bold text-white">{project.name}</h2>
            <p className="mt-2 text-xs text-slate-500">
              Project #{project.id} · row version {project.rowVersion}
            </p>
          </div>
          <span className="rounded-full border border-purple-500/30 px-3 py-1 text-xs font-semibold text-purple-300">
            {project.status}
          </span>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <ProjectDatum label="Story language" value={project.sourceLanguage} />
          <ProjectDatum label="Frame" value={project.imageAspectRatio} />
          <ProjectDatum label="Quality" value={project.imageQualityTier} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800/80 bg-[#0d1420]/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-purple-300">Chapters</p>
            <h3 className="mt-1 text-lg font-semibold text-white">Nội dung truyện theo Chapter</h3>
            <p className="mt-1 text-sm text-slate-400">
              {storyQuery.data
                ? `Story Version #${storyQuery.data.versionNumber}`
                : "Chưa có Story Version"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen((open) => !open)}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
          >
            + Add Chapter
          </button>
        </div>

        {formOpen && (
          <div className="mt-5 space-y-3 rounded-xl border border-slate-700 bg-[#090e18] p-4">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={`Chapter ${chapters.length + 1}`}
              maxLength={200}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
            />
            <textarea
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="Dán nội dung Chapter..."
              rows={10}
              className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm leading-6 text-slate-200 outline-none focus:border-purple-500"
            />
            {formError && (
              <p role="alert" className="text-xs text-rose-300">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => createChapter.mutate()}
                disabled={createChapter.isPending || !title.trim() || !sourceText.trim()}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {createChapter.isPending ? "Đang tạo…" : "Tạo Chapter"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 space-y-2">
          {chaptersQuery.isPending && storyVersionId && (
            <p className="text-sm text-slate-400">Đang tải Chapters…</p>
          )}
          {!chaptersQuery.isPending && chapters.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">
              Chưa có Chapter. Tạo Chapter đầu tiên để nhập nội dung truyện.
            </p>
          )}
          {chapters.map((chapter) => (
            <button
              type="button"
              key={chapter.id}
              onClick={() => router.push(`/projects/${numericProjectId}/chapters/${chapter.id}`)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-[#090e18] px-4 py-3 text-left hover:border-purple-500/50"
            >
              <div>
                <p className="text-sm font-semibold text-slate-200">{chapter.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Chapter #{chapter.orderIndex + 1} · row version {chapter.rowVersion}
                </p>
              </div>
              <span className="text-xs text-purple-300">Mở editor →</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function WorkspaceError({ error, fallback }: { error: unknown; fallback: string }) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-sm text-rose-200">
      {apiErrorMessage(error, fallback)}
    </div>
  );
}

function ProjectDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#090e18] p-4">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function WorkspaceMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0d1420]/50 p-8 text-sm text-slate-300">
      {children}
    </div>
  );
}
