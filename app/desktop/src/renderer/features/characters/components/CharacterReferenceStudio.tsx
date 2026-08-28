import { useEffect, useMemo, useState } from "react";
import type { DesktopCharacterDetail } from "@narrativex/client-contracts";
import { Check, ImagePlus, Loader2, LockKeyhole, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assetsApi } from "../../assets/api/assets.api";
import {
  useCharacterReferenceActions,
  useCharacterReferences,
} from "../queries/characters.queries";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusLabel(status?: string | null) {
  return (status ?? "NO VERSION").replaceAll("_", " ");
}

export function CharacterReferenceStudio({
  projectId,
  character,
}: Readonly<{
  projectId: string;
  character: DesktopCharacterDetail;
}>) {
  const versionId = character.version?.id ?? null;
  const status = character.version?.status ?? null;
  const referencesQuery = useCharacterReferences(projectId, character.id, versionId);
  const actions = useCharacterReferenceActions(projectId, character.id, versionId);
  const [notice, setNotice] = useState<string | null>(null);
  const [bible, setBible] = useState(character.version?.bible ?? "");
  const [visualPrompt, setVisualPrompt] = useState(character.version?.visualPrompt ?? "");

  useEffect(() => {
    setBible(character.version?.bible ?? "");
    setVisualPrompt(character.version?.visualPrompt ?? "");
    setNotice(null);
  }, [character.id, character.version?.id, character.version?.bible, character.version?.visualPrompt]);

  const identity = useMemo(
    () => referencesQuery.data?.find((reference) => reference.role.toUpperCase() === "IDENTITY") ?? null,
    [referencesQuery.data],
  );
  const identityPreview = useIdentityPreview(identity?.assetId ?? null);
  const busy =
    actions.createVersion.isPending ||
    actions.generateIdentity.isPending ||
    actions.importIdentity.isPending ||
    actions.review.isPending ||
    actions.pin.isPending ||
    actions.lockAndPin.isPending;
  const isDraft = status === "DRAFT" || status === "GENERATING";
  const isReview = status === "REVIEW";
  const isLocked = status === "LOCKED";
  const isPinned = Boolean(versionId && character.pinnedCharacterVersionId === versionId);

  async function createDraft() {
    if (!bible.trim() || !visualPrompt.trim()) return;
    setNotice(null);
    try {
      await actions.createVersion.mutateAsync({ bible: bible.trim(), visualPrompt: visualPrompt.trim() });
      setNotice("Draft character version đã được tạo.");
    } catch (error) {
      setNotice(errorMessage(error, "Không thể tạo character version."));
    }
  }

  async function generateIdentity() {
    if (!character.version?.visualPrompt?.trim()) return;
    setNotice(null);
    try {
      await actions.generateIdentity.mutateAsync({
        canonicalName: character.canonicalName,
        visualPrompt: character.version.visualPrompt,
        bible: character.version.bible,
        appearance: character.appearance,
      });
      setNotice(identity ? "Identity reference đã được regenerate." : "Identity reference đã được tạo.");
    } catch (error) {
      setNotice(errorMessage(error, "Không thể generate identity reference."));
    }
  }

  async function importIdentity() {
    setNotice(null);
    try {
      const result = await actions.importIdentity.mutateAsync();
      if (result) setNotice("Ảnh đã được import làm identity reference.");
    } catch (error) {
      setNotice(errorMessage(error, "Không thể import identity reference."));
    }
  }

  async function approve() {
    setNotice(null);
    try {
      await actions.review.mutateAsync();
      setNotice("Identity reference đã được approve và sẵn sàng để lock.");
    } catch (error) {
      setNotice(errorMessage(error, "Không thể approve character version."));
    }
  }

  async function lockAndUse() {
    setNotice(null);
    try {
      await actions.lockAndPin.mutateAsync();
      setNotice("Character version đã LOCKED và được dùng cho storyboard generation.");
    } catch (error) {
      setNotice(errorMessage(error, "Không thể lock hoặc pin character version."));
    }
  }

  async function useInProject() {
    setNotice(null);
    try {
      await actions.pin.mutateAsync();
      setNotice("Character version đã được pin và sẽ dùng cho storyboard generation.");
    } catch (error) {
      setNotice(errorMessage(error, "Không thể pin character version vào project."));
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface-dark p-3 2xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ImagePlus aria-hidden="true" size={14} className="text-primary-hover" />
            <h3 className="text-xs font-semibold">Character Reference Studio</h3>
          </div>
          <p className="mt-1 text-[9px] leading-4 text-text-muted">
            Tạo canonical identity trước khi generate Visual Beat. Chỉ version LOCKED mới được dùng làm reference.
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${isLocked ? "bg-emerald-500/10 text-emerald-500" : isReview ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary-hover"}`}>
          {statusLabel(status)}
        </span>
      </div>

      {!versionId ? (
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1 text-[9px] text-text-muted">
            Character bible
            <textarea
              value={bible}
              onChange={(event) => setBible(event.target.value)}
              rows={4}
              className="min-h-20 resize-y rounded-md border border-input bg-background px-3 py-2 text-[10px] text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="Canonical identity, stable traits, personality cues…"
            />
          </label>
          <label className="grid gap-1 text-[9px] text-text-muted">
            Visual identity prompt
            <textarea
              value={visualPrompt}
              onChange={(event) => setVisualPrompt(event.target.value)}
              rows={4}
              className="min-h-20 resize-y rounded-md border border-input bg-background px-3 py-2 text-[10px] text-foreground outline-none focus:ring-2 focus:ring-ring"
              placeholder="Face, hair, age, body proportions and defining visual traits…"
            />
          </label>
          <div>
            <Button
              size="sm"
              onClick={() => void createDraft()}
              disabled={busy || !bible.trim() || !visualPrompt.trim()}
            >
              {actions.createVersion.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Create Draft Version
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <div className="aspect-[4/5] bg-primary-muted">
              {identityPreview.url ? (
                <img src={identityPreview.url} alt={`${character.canonicalName} identity reference`} className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center px-4 text-center text-[9px] text-text-dim">
                  {identityPreview.loading ? "Đang tải reference…" : "Chưa có IDENTITY reference"}
                </div>
              )}
            </div>
            <div className="border-t border-border px-3 py-2 text-[9px] text-text-muted">
              <strong className="text-foreground">IDENTITY</strong> · priority 0 · required
            </div>
          </div>

          <div className="min-w-0">
            <div className="rounded-md border border-border bg-card p-3 text-[9px] leading-4 text-text-muted">
              <strong className="text-foreground">Visual prompt</strong>
              <p className="mt-1 whitespace-pre-wrap">{character.version?.visualPrompt || "—"}</p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {isDraft && (
                <>
                  <Button size="sm" onClick={() => void generateIdentity()} disabled={busy || !character.version?.visualPrompt?.trim()}>
                    {actions.generateIdentity.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {identity ? "Regenerate Identity" : "Generate Identity"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void importIdentity()} disabled={busy}>
                    {actions.importIdentity.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    Import
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void approve()} disabled={busy || !identity}>
                    {actions.review.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Approve Reference
                  </Button>
                </>
              )}

              {isReview && (
                <Button size="sm" onClick={() => void lockAndUse()} disabled={busy || !identity}>
                  {actions.lockAndPin.isPending ? <Loader2 size={13} className="animate-spin" /> : <LockKeyhole size={13} />}
                  Lock & Use in Project
                </Button>
              )}

              {isLocked && !isPinned && (
                <Button size="sm" onClick={() => void useInProject()} disabled={busy}>
                  {actions.pin.isPending ? <Loader2 size={13} className="animate-spin" /> : <LockKeyhole size={13} />}
                  Use in Project
                </Button>
              )}
            </div>

            {isReview && (
              <p className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-[9px] leading-4 text-amber-500">
                Reference đã được approve. Lock sẽ làm version immutable và cho phép Storyboard tự động gửi ảnh này lên Gemini.
              </p>
            )}
            {isLocked && isPinned && (
              <p className="mt-3 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2 text-[9px] leading-4 text-emerald-500">
                Canonical identity đã LOCKED và pin vào project. Visual Beat có nhân vật này sẽ tự động resolve và upload reference.
              </p>
            )}
            {isLocked && !isPinned && (
              <p className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-[9px] leading-4 text-amber-500">
                Version đã LOCKED nhưng chưa được pin vào project. Bấm Use in Project để hoàn tất continuity flow.
              </p>
            )}
          </div>
        </div>
      )}

      {notice && <p role="status" aria-live="polite" className="mt-3 text-[9px] text-text-muted">{notice}</p>}
    </section>
  );
}

function useIdentityPreview(assetId: string | null) {
  const [state, setState] = useState<{ assetId: string | null; url: string | null; loading: boolean }>({
    assetId: null,
    url: null,
    loading: false,
  });

  useEffect(() => {
    let cancelled = false;
    if (!assetId) {
      setState({ assetId: null, url: null, loading: false });
      return () => {
        cancelled = true;
      };
    }
    setState({ assetId, url: null, loading: true });
    void assetsApi
      .downloadUrl(assetId)
      .then((result) => {
        if (!cancelled) setState({ assetId, url: result.url, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ assetId, url: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  return { url: state.assetId === assetId ? state.url : null, loading: state.assetId === assetId && state.loading };
}
