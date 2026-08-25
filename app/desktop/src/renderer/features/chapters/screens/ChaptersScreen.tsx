import { useEffect, useMemo, useState } from "react";
import type { DesktopChapterDetails } from "@narrativex/client-contracts";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FeaturePage, EmptyState } from "../../workspace/components/FeaturePage";
import {
  useCreateChapter,
  useDeleteChapter,
  useUpdateChapter,
} from "../queries/chapters.queries";

export function ChaptersScreen({
  projectId,
  storyVersionId,
  chapters,
}: Readonly<{
  projectId: string;
  storyVersionId: string | null;
  chapters: DesktopChapterDetails[];
}>) {
  const createChapter = useCreateChapter(projectId);
  const updateChapter = useUpdateChapter(projectId);
  const deleteChapter = useDeleteChapter(projectId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const selected = chapters.find((chapter) => chapter.id === editingId) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return chapters;
    return chapters.filter((chapter) =>
      `${chapter.title} ${chapter.sourceText}`.toLocaleLowerCase().includes(needle),
    );
  }, [chapters, query]);

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title);
    setSourceText(selected.sourceText);
  }, [selected]);

  const busy = createChapter.isPending || updateChapter.isPending || deleteChapter.isPending;

  function startNew() {
    setEditingId(null);
    setTitle("");
    setSourceText("");
    setNotice(null);
  }

  async function save() {
    if (!title.trim() || !sourceText.trim() || busy) return;
    setNotice(null);
    try {
      if (selected) {
        await updateChapter.mutateAsync({
          chapterId: selected.id,
          title: title.trim(),
          sourceText,
          rowVersion: selected.rowVersion,
        });
        setNotice("Chapter đã được cập nhật.");
      } else {
        await createChapter.mutateAsync({
          storyVersionId: storyVersionId ?? undefined,
          orderIndex: chapters.length,
          title: title.trim(),
          sourceText,
        });
        setNotice("Chapter mới đã được tạo.");
      }
      startNew();
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  async function remove(chapter: DesktopChapterDetails) {
    if (!window.confirm(`Xóa chapter “${chapter.title}”?`)) return;
    setNotice(null);
    try {
      await deleteChapter.mutateAsync(chapter.id);
      if (editingId === chapter.id) startNew();
      setNotice("Chapter đã được xóa.");
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  return (
    <FeaturePage
      title="Chapter Workspace"
      description="Quản lý nội dung chapter độc lập với editor timeline. Dữ liệu được đồng bộ trực tiếp qua chapter API của feature."
      actions={
        <Button size="sm" onClick={startNew}>
          <Plus size={14} /> New chapter
        </Button>
      }
    >
      <div className="grid min-h-[560px] grid-cols-[minmax(260px,.72fr)_minmax(0,1.28fr)] gap-3">
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border p-3">
            <label className="flex items-center gap-2 rounded-md border border-input bg-popover px-2 text-muted-foreground">
              <Search size={13} />
              <input
                className="h-8 min-w-0 flex-1 bg-transparent text-[10px] text-foreground outline-none"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm chapter…"
              />
            </label>
          </div>
          <div className="max-h-[calc(100vh-190px)] overflow-auto p-2">
            {filtered.map((chapter) => (
              <div
                key={chapter.id}
                className={`mb-1 flex items-center gap-2 rounded-md border p-2 ${
                  editingId === chapter.id
                    ? "border-primary bg-primary-muted"
                    : "border-border-subtle bg-popover"
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setEditingId(chapter.id)}
                >
                  <strong className="block truncate text-[11px]">{chapter.title}</strong>
                  <span className="text-[9px] text-muted-foreground">
                    {wordCount(chapter.sourceText)} từ · v{chapter.rowVersion}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Xóa ${chapter.title}`}
                  onClick={() => void remove(chapter)}
                  disabled={busy}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
            {!filtered.length && (
              <EmptyState title="Chưa có chapter" description="Tạo chapter đầu tiên để bắt đầu story flow." />
            )}
          </div>
        </section>

        <section className="grid content-start gap-3 rounded-lg border border-border bg-card p-4">
          <div>
            <span className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">
              {selected ? "Đang chỉnh sửa" : "Chapter mới"}
            </span>
            <Input
              className="mt-2"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Tên chapter"
            />
          </div>
          <Textarea
            className="min-h-[360px] resize-none"
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder="Nội dung chapter…"
          />
          <div className="flex items-center gap-2">
            <Button onClick={() => void save()} disabled={!title.trim() || !sourceText.trim() || busy}>
              {busy ? "Đang lưu…" : selected ? "Lưu thay đổi" : "Tạo chapter"}
            </Button>
            <span className="text-[10px] text-muted-foreground">
              {wordCount(sourceText)} từ · {sourceText.length} ký tự
            </span>
          </div>
          {notice && <p className="text-[10px] text-muted-foreground">{notice}</p>}
        </section>
      </div>
    </FeaturePage>
  );
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Thao tác chapter thất bại.";
}
