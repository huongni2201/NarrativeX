import { useEffect, useMemo, useState } from "react";
import type { CharacterReferenceSlot, DesktopCharacterDetail } from "../../../../shared/api-types";
import { Check, ImagePlus, Loader2, LockKeyhole, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { localAssetPreviewUrl } from "../../../../shared/local-asset-preview-url";
import { InlineNotice, StatusIndicator } from "../../workspace/components/WorkstationPrimitives";
import {
  useCharacterAssetPreview,
  useCharacterReferenceActions,
  useCharacterReferences,
} from "../queries/characters.queries";

const REFERENCE_SLOTS: { slot: CharacterReferenceSlot; label: string }[] = [
  { slot: "FACE_FRONT", label: "Face front" },
  { slot: "FACE_THREE_QUARTER_LEFT", label: "Face 3/4 left" },
  { slot: "FACE_THREE_QUARTER_RIGHT", label: "Face 3/4 right" },
  { slot: "FACE_PROFILE_LEFT", label: "Face profile left" },
  { slot: "FACE_PROFILE_RIGHT", label: "Face profile right" },
  { slot: "BODY_FRONT", label: "Body front" },
  { slot: "BODY_SIDE", label: "Body side" },
  { slot: "BODY_BACK", label: "Body back" },
];

const DEFAULT_VISUAL_PROFILE = JSON.stringify({
  schemaVersion: 1,
  ageDescription: "adult",
  faceShape: "",
  eyeDescription: "",
  skinDescription: "",
  hairColor: "",
  hairSilhouette: "",
  bodyType: "",
  heightCm: null,
  headToBodyRatio: null,
  proportionDescription: "",
  distinctiveFeatures: [],
  baselineWardrobe: "",
  styleKey: "CINEMATIC",
}, null, 2);

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
  const [multiViewDraft, setMultiViewDraft] = useState(false);
  const [visualProfileJson, setVisualProfileJson] = useState(DEFAULT_VISUAL_PROFILE);

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
    actions.importIdentity.isPending ||
    actions.review.isPending ||
    actions.pin.isPending ||
    actions.lockAndPin.isPending;
  const isDraft = status === "DRAFT" || status === "GENERATING";
  const isReview = status === "REVIEW";
  const isLocked = status === "LOCKED";
  const isMultiView = character.version?.referencePolicy === "MULTI_VIEW_V1";
  const isPinned = Boolean(versionId && character.pinnedCharacterVersionId === versionId);
  const completeReferencePack =
    isMultiView &&
    REFERENCE_SLOTS.every((entry) => referencesQuery.data?.some((reference) => reference.slot === entry.slot));

  async function createDraft() {
    if (!bible.trim() || (!multiViewDraft && !visualPrompt.trim())) return;
    setNotice(null);
    try {
      if (multiViewDraft) {
        await actions.createVersion.mutateAsync({
          bible: bible.trim(),
          visualProfile: JSON.parse(visualProfileJson),
        });
      } else {
        await actions.createVersion.mutateAsync({ bible: bible.trim(), visualPrompt: visualPrompt.trim() });
      }
      setNotice("Draft character version đã được tạo.");
    } catch (error) {
      setNotice(errorMessage(error, "Không thể tạo character version."));
    }
  }

  async function importSlot(slot: CharacterReferenceSlot) {
    setNotice(null);
    try {
      const result = await actions.importSlot.mutateAsync(slot);
      if (result) setNotice(`Đã lưu reference ${slot}. Runtime hiện chưa dùng reference để conditioning ảnh/video.`);
    } catch (error) {
      setNotice(errorMessage(error, `Không thể import reference ${slot}.`));
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
      setNotice("Character version đã LOCKED và pin vào project. Runtime hiện chưa conditioning ảnh/video bằng reference này.");
    } catch (error) {
      setNotice(errorMessage(error, "Không thể lock hoặc pin character version."));
    }
  }

  async function useInProject() {
    setNotice(null);
    try {
      await actions.pin.mutateAsync();
      setNotice("Character version đã được pin vào project. Runtime hiện chưa conditioning ảnh/video bằng reference này.");
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
            <h3 className="text-label font-semibold text-foreground">Identity Reference</h3>
            <p className="truncate text-caption text-text-dim">Approved identity guidance. Current image/video runtime does not condition on its image references.</p>
          </div>
        </div>
        <StatusIndicator
          label={statusLabel(status)}
          tone={isLocked ? "success" : isReview ? "warning" : versionId ? "accent" : "neutral"}
        />
      </div>

      {!versionId ? (
        <div className="grid gap-2.5">
          <label className="grid gap-1 text-caption text-text-muted">
            Character bible
            <Textarea
              value={bible}
              onChange={(event) => setBible(event.target.value)}
              rows={5}
              className="min-h-28 resize-y"
              placeholder="Canonical identity, stable traits, personality cues…"
            />
          </label>
          <label className="flex items-start gap-2 text-caption text-text-muted">
            <input type="checkbox" checked={multiViewDraft} onChange={(event) => setMultiViewDraft(event.target.checked)} />
            Create a typed eight-view reference pack
          </label>
          {multiViewDraft ? (
            <label className="grid gap-1 text-caption text-text-muted">
              Visual profile JSON
              <Textarea value={visualProfileJson} onChange={(event) => setVisualProfileJson(event.target.value)} rows={12} className="min-h-56 resize-y font-mono" />
            </label>
          ) : (
            <label className="grid gap-1 text-caption text-text-muted">
              Visual identity prompt
              <Textarea value={visualPrompt} onChange={(event) => setVisualPrompt(event.target.value)} rows={5} className="min-h-28 resize-y" placeholder="Face, hair, age, body proportions and defining visual traits…" />
            </label>
          )}
          <div>
            <Button size="sm" onClick={() => void createDraft()} disabled={busy || !bible.trim() || (!multiViewDraft && !visualPrompt.trim())}>
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
                <div className="grid size-full place-items-center px-4 text-center text-caption text-text-dim">
                  {identityPreview.isLoading ? "Đang tải reference…" : "Chưa có IDENTITY reference"}
                </div>
              )}
            </div>
            <div className="border-t border-border-subtle px-2.5 py-1.5 text-caption text-text-muted">
              <strong className="text-foreground">{isMultiView ? "FACE_FRONT" : "IDENTITY"}</strong> · priority 0 · required
            </div>
          </div>

          <div className="min-w-0">
            <div className="border-b border-border-subtle pb-2.5">
              <div className="text-caption font-semibold text-text-dim">Visual prompt</div>
              <p className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-caption leading-4 text-text-muted">
                {character.version?.visualPrompt || "—"}
              </p>
            </div>

            {isMultiView ? (
              <div className="mt-2.5">
                <div className="mb-2 text-caption font-semibold text-text-dim">Eight-view reference pack</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {REFERENCE_SLOTS.map(({ slot, label }) => {
                    const reference = referencesQuery.data?.find((item) => item.slot === slot);
                    return (
                      <div key={slot} className="flex min-w-0 items-center gap-2 border border-border-subtle bg-surface-dark p-1.5">
                        {reference ? <img src={localAssetPreviewUrl(projectId, reference.assetId)} alt={label} className="size-9 shrink-0 object-cover" /> : <div className="grid size-9 shrink-0 place-items-center bg-surface-2 text-caption text-text-dim">—</div>}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-caption text-text-muted">{label}</div>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => void importSlot(slot)} className="mt-1 h-6 px-1.5 text-caption">
                            {reference ? "Replace" : "Import"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <InlineNotice tone="warning" className="mt-2">The current image and video runtime does not condition generation on these references. Locking the pack records the reviewed identity contract only.</InlineNotice>
              </div>
            ) : null}

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {isDraft ? (
                <>
                  {!isMultiView ? (
                    <Button size="sm" variant="outline" onClick={() => void importIdentity()} disabled={busy}>
                      {actions.importIdentity.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      Import
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => void approve()} disabled={busy || (isMultiView ? !completeReferencePack : !identity)}>
                    {actions.review.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Approve
                  </Button>
                </>
              ) : null}
              {isReview ? (
                  <Button size="sm" onClick={() => void lockAndUse()} disabled={busy || (isMultiView ? !completeReferencePack : !identity)}>
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
            {isLocked && isPinned ? <InlineNotice tone="success" className="mt-3">Identity profile đã LOCKED và được pin vào project. Generation conditioning vẫn chưa được bật.</InlineNotice> : null}
            {isLocked && !isPinned ? <InlineNotice tone="warning" className="mt-3">Version đã LOCKED nhưng chưa pin vào project.</InlineNotice> : null}
          </div>
        </div>
      )}

      {notice ? <InlineNotice className="mt-3">{notice}</InlineNotice> : null}
    </section>
  );
}
