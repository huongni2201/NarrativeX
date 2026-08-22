"use client";

import Link from "next/link";
import { Clapperboard, ExternalLink } from "lucide-react";
import type { ApiProjectCharacterDetail } from "@/features/characters/api/characters.api";
import type { ApiProjectOverviewChapter } from "@/features/projects/api/project-overview.types";

interface CharacterAppearancesTabProps {
  character: ApiProjectCharacterDetail;
  projectId: number;
  chapters: ApiProjectOverviewChapter[];
}

export function CharacterAppearancesTab({
  character,
  projectId,
  chapters,
}: Readonly<CharacterAppearancesTabProps>) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-xl space-y-4">
      <h2 className="text-base font-bold text-text-primary">
        Danh sách Chapter và Scene có mặt {character.canonicalName}
      </h2>
      <div className="divide-y divide-border/70 border border-border rounded-xl bg-surface-2 overflow-hidden">
        {chapters.length > 0 ? (
          chapters.map((chapter) => (
            <div key={chapter.id} className="flex items-center justify-between p-4 hover:bg-surface-3 transition">
              <div className="flex items-center gap-3">
                <Clapperboard className="h-5 w-5 text-primary-light" />
                <div>
                  <h3 className="text-xs font-bold text-text-primary">
                    Chapter {chapter.orderIndex + 1}: {chapter.title}
                  </h3>
                  <span className="text-[11px] text-text-muted">
                    Trạng thái: {chapter.status} · Xuất hiện trong cảnh quay
                  </span>
                </div>
              </div>
              <Link
                href={`/projects/${projectId}/chapters/${chapter.id}`}
                className="flex items-center gap-1 text-xs font-semibold text-primary-light hover:text-white"
              >
                <span>Mở Chapter</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-xs text-text-muted">Chưa có chapter nào.</div>
        )}
      </div>
    </div>
  );
}
