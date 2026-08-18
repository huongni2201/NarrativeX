"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chaptersApi } from "@/features/chapters/api/chapters.api";
import { queryKeys } from "@/lib/query-keys";
import { ApiClientError, apiErrorMessage } from "@/shared/api/client";

interface ChapterEditorProps {
  projectId: string;
  chapterId: string;
}

export function ChapterEditor({ projectId, chapterId }: Readonly<ChapterEditorProps>) {
  const numericProjectId = Number(projectId);
  const numericChapterId = Number(chapterId);
  const validIds =
    Number.isSafeInteger(numericProjectId) &&
    numericProjectId > 0 &&
    Number.isSafeInteger(numericChapterId) &&
    numericChapterId > 0;
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [rowVersion, setRowVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const chapterQuery = useQuery({
    queryKey: validIds
      ? queryKeys.chapter(numericProjectId, numericChapterId)
      : ["chapters", "invalid"],
    queryFn: () => chaptersApi.getById(numericProjectId, numericChapterId),
    enabled: validIds,
  });

  useEffect(() => {
    if (!chapterQuery.data || dirty) return;
    setTitle(chapterQuery.data.title);
    setSourceText(chapterQuery.data.sourceText);
    setRowVersion(chapterQuery.data.rowVersion);
  }, [chapterQuery.data, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [dirty]);

  const updateChapter = useMutation({
    mutationFn: () =>
      chaptersApi.update(numericProjectId, numericChapterId, rowVersion, {
        title,
        sourceText,
      }),
    onSuccess: (chapter) => {
      queryClient.setQueryData(queryKeys.chapter(numericProjectId, numericChapterId), chapter);
      setTitle(chapter.title);
      setSourceText(chapter.sourceText);
      setRowVersion(chapter.rowVersion);
      setDirty(false);
      setSaveMessage("Đã lưu Chapter.");
    },
    onError: (error) => {
      if (error instanceof ApiClientError && error.status === 409) {
        setSaveMessage(
          "Chapter đã thay đổi ở phiên khác. Nội dung bạn đang sửa vẫn được giữ; tải bản mới trước khi ghi tiếp.",
        );
        return;
      }
      setSaveMessage(apiErrorMessage(error, "Không thể lưu Chapter."));
    },
  });

  useEffect(() => {
    const saveShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty && !updateChapter.isPending && title.trim()) updateChapter.mutate();
      }
    };
    window.addEventListener("keydown", saveShortcut);
    return () => window.removeEventListener("keydown", saveShortcut);
  }, [dirty, title, updateChapter]);

  if (!validIds) return <EditorMessage>Chapter route không hợp lệ.</EditorMessage>;
  if (chapterQuery.isPending) return <EditorMessage>Đang tải Chapter từ backend…</EditorMessage>;
  if (chapterQuery.isError) {
    return (
      <EditorMessage>
        {apiErrorMessage(chapterQuery.error, "Không tải được Chapter từ backend.")}
      </EditorMessage>
    );
  }

  const markDirty = () => {
    setDirty(true);
    setSaveMessage(null);
  };

  const reloadLatest = async () => {
    const latest = await chapterQuery.refetch();
    if (!latest.data) return;
    setTitle(latest.data.title);
    setSourceText(latest.data.sourceText);
    setRowVersion(latest.data.rowVersion);
    setDirty(false);
    setSaveMessage("Đã tải phiên bản mới nhất từ server.");
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800/80 bg-[#0d1420]/80 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-purple-300">Chapter source</p>
            <p className="mt-1 text-xs text-slate-500">
              Chapter #{numericChapterId} · row version {rowVersion}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs ${
              dirty
                ? "border-amber-500/30 text-amber-300"
                : "border-emerald-500/30 text-emerald-300"
            }`}
          >
            {dirty ? "Chưa lưu" : "Đã đồng bộ"}
          </span>
        </div>

        <label className="mt-5 block space-y-2">
          <span className="text-xs font-medium text-slate-300">Tiêu đề Chapter</span>
          <input
            value={title}
            maxLength={200}
            onChange={(event) => {
              setTitle(event.target.value);
              markDirty();
            }}
            className="w-full rounded-xl border border-slate-700 bg-[#090e18] px-4 py-3 text-sm text-white outline-none focus:border-purple-500"
          />
        </label>

        <label className="mt-4 block space-y-2">
          <span className="text-xs font-medium text-slate-300">Nội dung truyện</span>
          <textarea
            value={sourceText}
            onChange={(event) => {
              setSourceText(event.target.value);
              markDirty();
            }}
            rows={24}
            className="min-h-[420px] w-full resize-y rounded-xl border border-slate-700 bg-[#090e18] px-4 py-4 font-mono text-sm leading-6 text-slate-200 outline-none focus:border-purple-500"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {Array.from(sourceText).length.toLocaleString()} ký tự · SHA-256 được backend tính khi lưu
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reloadLatest}
              disabled={chapterQuery.isFetching || updateChapter.isPending}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Tải bản mới nhất
            </button>
            <button
              type="button"
              onClick={() => updateChapter.mutate()}
              disabled={!dirty || !title.trim() || updateChapter.isPending}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updateChapter.isPending ? "Đang lưu…" : "Lưu Chapter"}
            </button>
          </div>
        </div>

        {saveMessage && (
          <p className="mt-4 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
            {saveMessage}
          </p>
        )}
      </section>
    </div>
  );
}

function EditorMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0d1420]/50 p-8 text-sm text-slate-300">
      {children}
    </div>
  );
}
