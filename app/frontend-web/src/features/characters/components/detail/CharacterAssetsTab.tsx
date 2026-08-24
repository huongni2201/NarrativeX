"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { assetsApi } from "@/features/assets/api/assets.api";
import {
  charactersApi,
  type ApiCharacterReferenceRole,
  type ApiCharacterVersionReference,
} from "@/features/characters/api/characters.api";
import type { ApiProjectAsset } from "@/features/projects/api/project-resources.types";
import { apiErrorMessage } from "@/shared/api/client";

interface CharacterAssetsTabProps {
  characterId: string;
  versionId: string | null;
  versionStatus: string | null;
  projectAssets: ApiProjectAsset[];
}

const ROLE_LABELS: Record<ApiCharacterReferenceRole, string> = {
  IDENTITY: "Identity",
  PROFILE: "Góc nghiêng",
  EXPRESSION: "Biểu cảm",
  OUTFIT: "Trang phục",
  POSE: "Tư thế",
};

export function CharacterAssetsTab({
  characterId,
  versionId,
  versionStatus,
  projectAssets,
}: Readonly<CharacterAssetsTabProps>) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const editable = Boolean(versionId) && versionStatus !== "LOCKED";
  const referencesKey = ["characters", characterId, "versions", versionId, "references"] as const;

  const referencesQuery = useQuery({
    queryKey: referencesKey,
    queryFn: () => charactersApi.getVersionReferences(characterId, versionId!),
    enabled: Boolean(versionId),
  });
  const imagesQuery = useQuery({
    queryKey: ["assets", "character-reference-images"],
    queryFn: () => assetsApi.list({ type: "IMAGE", status: "READY" }),
    enabled: editable,
  });

  const saveMutation = useMutation({
    mutationFn: (references: ApiCharacterVersionReference[]) =>
      charactersApi.setVersionReferences(characterId, versionId!, references),
    onSuccess: async (references) => {
      setError(null);
      queryClient.setQueryData(referencesKey, references);
      await queryClient.invalidateQueries({ queryKey: referencesKey });
    },
    onError: (mutationError) => {
      setError(apiErrorMessage(mutationError, "Không thể cập nhật ảnh reference."));
    },
  });

  const references = useMemo(() => referencesQuery.data ?? [], [referencesQuery.data]);
  const mediaById = useMemo(
    () => new Map((imagesQuery.data?.items ?? []).map((asset) => [asset.id, asset])),
    [imagesQuery.data?.items],
  );
  const selectedIds = useMemo(() => new Set(references.map((reference) => reference.assetId)), [references]);
  const availableImages = (imagesQuery.data?.items ?? []).filter((asset) => !selectedIds.has(asset.id));

  const addReference = (assetId: string) => {
    if (!editable || saveMutation.isPending) return;
    const nextPriority = references.length === 0 ? 0 : Math.max(...references.map((item) => item.priority)) + 1;
    const role: ApiCharacterReferenceRole = references.length === 0 ? "IDENTITY" : "PROFILE";
    saveMutation.mutate([...references, { assetId, role, priority: nextPriority }]);
  };

  const removeReference = (assetId: string) => {
    if (!editable || saveMutation.isPending) return;
    const remaining = references.filter((reference) => reference.assetId !== assetId);
    const normalized = remaining.map((reference, index) => ({
      ...reference,
      role: index === 0 ? ("IDENTITY" as const) : reference.role,
      priority: index,
    }));
    saveMutation.mutate(normalized);
  };

  const makeIdentity = (assetId: string) => {
    if (!editable || saveMutation.isPending) return;
    const reordered = [...references].sort((left, right) => {
      if (left.assetId === assetId) return -1;
      if (right.assetId === assetId) return 1;
      return left.priority - right.priority;
    });
    saveMutation.mutate(
      reordered.map((reference, index) => ({
        ...reference,
        role:
          index === 0
            ? ("IDENTITY" as const)
            : reference.role === "IDENTITY"
              ? ("PROFILE" as const)
              : reference.role,
        priority: index,
      })),
    );
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-surface-card p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-text-primary">Ảnh reference nhân vật</h2>
            <p className="mt-1 text-xs text-text-muted">
              NarrativeX snapshot tối đa 3 ảnh phù hợp cho mỗi scene và gửi chúng cùng prompt vào Gemini để giữ identity nhất quán.
            </p>
          </div>
          <Link
            href="/assets"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-text-primary transition hover:border-primary/60 hover:text-primary-light"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Upload ảnh mới
          </Link>
        </div>

        {!versionId && (
          <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            Hãy pin một Character Version trước khi gắn ảnh reference.
          </p>
        )}
        {versionId && versionStatus === "LOCKED" && (
          <p className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted">
            Character Version này đã LOCKED nên reference là immutable. Tạo version mới nếu cần thay đổi identity assets.
          </p>
        )}
        {error && <p className="rounded-lg border border-danger/30 bg-danger-bg/20 px-3 py-2 text-xs text-danger">{error}</p>}

        {referencesQuery.isPending && versionId ? (
          <div className="flex items-center gap-2 py-4 text-xs text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải reference…
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {references.map((reference) => {
              const media = mediaById.get(reference.assetId);
              return (
                <div key={reference.assetId} className="rounded-xl border border-primary/30 bg-primary-muted/10 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {reference.priority === 0 && <Star className="h-3.5 w-3.5 fill-current text-warning" />}
                        <span className="truncate text-xs font-bold text-text-primary">
                          {media?.originalFilename ?? `Asset ${reference.assetId.slice(0, 8)}`}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-text-muted">
                        {ROLE_LABELS[reference.role]} · priority {reference.priority}
                      </p>
                    </div>
                    {editable && (
                      <button
                        type="button"
                        aria-label="Bỏ ảnh reference"
                        onClick={() => removeReference(reference.assetId)}
                        disabled={saveMutation.isPending}
                        className="rounded-md p-1 text-text-muted transition hover:bg-danger-bg hover:text-danger disabled:opacity-40"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {editable && reference.priority !== 0 && (
                    <button
                      type="button"
                      onClick={() => makeIdentity(reference.assetId)}
                      disabled={saveMutation.isPending}
                      className="mt-3 text-[10px] font-semibold text-primary-light hover:underline disabled:opacity-40"
                    >
                      Đặt làm identity chính
                    </button>
                  )}
                </div>
              );
            })}
            {references.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-border px-4 py-7 text-center text-xs text-text-muted">
                Chưa có ảnh reference. Identity vẫn dựa vào visual prompt cho tới khi bạn gắn ảnh.
              </div>
            )}
          </div>
        )}

        {editable && (
          <div className="border-t border-border pt-4">
            <h3 className="text-xs font-bold text-text-primary">Chọn từ Media Library</h3>
            <p className="mt-1 text-[11px] text-text-muted">Chỉ hiển thị ảnh đã validate READY.</p>
            {imagesQuery.isPending ? (
              <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang tải ảnh…
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {availableImages.slice(0, 12).map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => addReference(asset.id)}
                    disabled={saveMutation.isPending || references.length >= 8}
                    className="rounded-xl border border-border bg-surface-2 p-3 text-left transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="block truncate text-xs font-semibold text-text-primary">{asset.originalFilename}</span>
                    <span className="mt-1 block text-[10px] text-text-muted">{asset.contentType} · {(asset.sizeBytes / 1024).toFixed(0)} KB</span>
                  </button>
                ))}
                {availableImages.length === 0 && (
                  <p className="col-span-full text-xs text-text-muted">Không còn ảnh READY nào để thêm.</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface-card p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-text-primary">Tài sản dự án</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projectAssets.length > 0 ? (
            projectAssets.map((asset) => (
              <div key={asset.id} className="rounded-xl border border-border bg-surface-2 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary">{asset.name}</span>
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted">{asset.assetType}</span>
                </div>
                <p className="text-[11px] text-text-muted">{asset.storageKey}</p>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-xs text-text-muted">Chưa có project asset nào.</div>
          )}
        </div>
      </section>
    </div>
  );
}
