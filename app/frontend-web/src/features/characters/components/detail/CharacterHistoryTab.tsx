"use client";

import type { ApiProjectCharacterDetail } from "@/features/characters/api/characters.api";
import { formatDateTime } from "./character-detail.types";

interface CharacterHistoryTabProps {
  character: ApiProjectCharacterDetail;
}

export function CharacterHistoryTab({ character }: Readonly<CharacterHistoryTabProps>) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-xl space-y-4">
      <h2 className="text-base font-bold text-text-primary">Lịch sử phiên bản & Metadata</h2>
      <div className="divide-y divide-border/70 border border-border rounded-xl bg-surface-2 text-xs">
        <div className="flex items-center justify-between p-3.5">
          <span className="text-text-muted">Ngày tạo bản ghi</span>
          <span className="font-semibold text-text-primary">{formatDateTime(character.createdAt)}</span>
        </div>
        <div className="flex items-center justify-between p-3.5">
          <span className="text-text-muted">Ngày cập nhật gần nhất</span>
          <span className="font-semibold text-text-primary">{formatDateTime(character.updatedAt)}</span>
        </div>
        <div className="flex items-center justify-between p-3.5">
          <span className="text-text-muted">Row Version</span>
          <span className="font-mono font-semibold text-primary-light">v{character.rowVersion}.0</span>
        </div>
        <div className="flex items-center justify-between p-3.5">
          <span className="text-text-muted">Pinned Character Version ID</span>
          <span className="font-mono font-semibold text-text-primary">
            {character.pinnedCharacterVersionId ?? "Chưa pin"}
          </span>
        </div>
        <div className="flex items-center justify-between p-3.5">
          <span className="text-text-muted">Assignment ID</span>
          <span className="font-mono font-semibold text-text-primary">{character.assignmentId}</span>
        </div>
      </div>
    </div>
  );
}
