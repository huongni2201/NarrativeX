import { useEffect, useMemo, useState } from "react";
import type { DesktopCharacterDetail } from "@narrativex/client-contracts";
import { Check, ImagePlus, Loader2, LockKeyhole, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { InlineNotice, StatusIndicator } from "../../workspace/components/WorkstationPrimitives";
import {
  useCharacterAssetPreview,
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
  generationLocked = false,
}: Readonly<{
  projectId: string;
  character: DesktopCharacterDetail;
  generationLocked?: boolean;
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
  const identityPreview = useCharacterAssetPreview(projectId, identity?.assetId ?? null);
  const busy =
    generationLocked ||
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
  const generationPrompt = character.version?.prompt?.trim() ?? "";

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
    if (!generationPrompt) return;
    setNotice(null);
    try {
      await actions.generateIdentity.mutateAsync({ prompt: generationPrompt });
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
    <section className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ImagePlus aria-hidden="true" size={13} className="shrink-0 text-primary" />
          <div className="min-w-0">
            <h3 className="text-[12px] font-semibold text-foreground">Identity Reference</h3>
            <p className="truncate text-[9px] text-text-dim">Canonical reference used by storyboard generation.</p>
          </div>
        </div>
        <StatusIndicator
          label={statusLabel(status)}
          tone={isLocked ? "success" : isReview ? "warning" : versionId ? "accent" : "neutral"}
        />
      </div>

      {!versionId ? (
        <div className="grid gap-2.5">
          <label className="grid gap-1 text-[9px] text-text-muted">
            Character bible
            <Textarea
              value={bible}
              onChange={(event) => setBible(event.target.value)}
              rows={5}
              className="min-h-28 resize-y"
              placeholder="Canonical identity, stable traits, personality cues…"
            />
          </label>
          <label className="grid gap-1 text-[9px] text-text-muted">
            Visual identity prompt
            <Textarea
              value={visualPrompt}
              onChange={(event) => setVisualPrompt(event.target.value)}
              rows={5}
              className="min-h-28 resize-y"
              placeholder="Face, hair, age, body proportions and defining visual traits…"
            />
          </label>
          <div>
            <Button size="sm" onClick={() => void createDraft()} disabled={busy || !bible.trim() || !visualPrompt.trim()}>
              {actions.createVersion.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Create Draft Version
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(190px,.65fr)_minmax(0,1.35fr)]">
          <div className="min-w-0 overflow-hidden border border-border-subtle bg-surface-dark">
            <div className="aspect-[4/5] bg-primary-muted">
              {identityPreview.url ? (
                <img src={identityPreview.url} alt={`${character.canonicalName} identity reference`} className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center px-4 text-center text-[9px] text-text-dim">
                  {identityPreview.isLoading ? "Đang tải reference…" : "Chưa có IDENTITY reference"}
                </div>
              )}
            </div>
            <div className="border-t border-border-subtle px-2.5 py-1.5 text-[9px] text-text-muted">
              <strong className="text-foreground">IDENTITY</strong> · priority 0 · required
            </div>
          </div>

          <div className="min-w-0">
            <div className="border-b border-border-subtle pb-2.5">
              <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-dim">Visual prompt</div>
              <p className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[10px] leading-4 text-text-muted">
                {character.version?.visualPrompt || "—"}
              </p>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {isDraft ? (
                <>
                  <Button size="sm" onClick={() => void generateIdentity()} disabled={busy || !generationPrompt}>
                    {actions.generateIdentity.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {identity ? "Regenerate" : "Generate Identity"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void importIdentity()} disabled={busy}>
                    {actions.importIdentity.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    Import
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void approve()} disabled={busy || !identity}>
                    {actions.review.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Approve
                  </Button>
                </>
              ) : null}
              {isReview ? (
                <Button size="sm" onClick={() => void lockAndUse()} disabled={busy || !identity}>
                  {actions.lockAndPin.isPending ? <Loader2 size={13} className="animate-spin" /> : <LockKeyhole size={13} />}
                  Lock & Use
                </Button>
              ) : null}
              {isLocked && !isPinned ? (
                <Button size="sm" onClick={() => void useInProject()} disabled={busy}>
                  {actions.pin.isPending ? <Loader2 size={13} className="animate-spin" /> : <LockKeyhole size={13} />}
                  Use in Project
                </Button>
              ) : null}
            </div>

            {generationLocked ? <InlineNotice tone="info" className="mt-3">Generate All đang chạy; action thủ công tạm khóa để tránh queue conflict.</InlineNotice> : null}
            {isReview ? <InlineNotice tone="warning" className="mt-3">Reference đã được approve. Lock sẽ làm version immutable và cho phép Storyboard dùng reference này.</InlineNotice> : null}
            {isLocked && isPinned ? <InlineNotice tone="success" className="mt-3">Canonical identity đã LOCKED và được pin vào project.</InlineNotice> : null}
            {isLocked && !isPinned ? <InlineNotice tone="warning" className="mt-3">Version đã LOCKED nhưng chưa pin vào project.</InlineNotice> : null}
          </div>
        </div>
      )}

      {notice ? <InlineNotice className="mt-3">{notice}</InlineNotice> : null}
    </section>
  );
}
