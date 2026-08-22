"use client";

import {
  Camera,
  ChevronRight,
  Clapperboard,
  Edit3,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  User,
  Users,
} from "lucide-react";
import type {
  ApiProjectCharacterDetail,
  ApiProjectCharacterSummary,
} from "@/features/characters/api/characters.api";
import type { ApiProjectOverviewChapter } from "@/features/projects/api/project-overview.types";
import type { DetailTab } from "./character-detail.types";

interface CharacterOverviewTabProps {
  character: ApiProjectCharacterDetail;
  roleBadge: { label: string; className: string };
  shortDescription: string;
  displayKeywords: string[];
  coCharacters: ApiProjectCharacterSummary[];
  chapters: ApiProjectOverviewChapter[];
  promptLines: string[];
  onSelectTab: (tab: DetailTab) => void;
}

export function CharacterOverviewTab({
  character,
  roleBadge,
  shortDescription,
  displayKeywords,
  coCharacters,
  chapters,
  promptLines,
  onSelectTab,
}: Readonly<CharacterOverviewTabProps>) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {/* Card 1: Thông tin cơ bản */}
      <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-card p-5 shadow-lg">
        <div>
          <div className="flex items-center gap-2 border-b border-border/80 pb-3 text-sm font-bold text-text-primary">
            <User className="h-4 w-4 text-primary-light" />
            <span>Thông tin cơ bản</span>
          </div>
          <div className="divide-y divide-border/60 text-sm">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-text-muted">Tên đầy đủ</span>
              <span className="font-semibold text-text-primary">{character.canonicalName}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-text-muted">Vai trò</span>
              <span className="font-semibold text-text-primary">{roleBadge.label}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-text-muted">Tuổi</span>
              <span className="font-semibold text-text-primary">
                {character.appearance?.ageState || "27"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-text-muted">Nghề nghiệp</span>
              <span className="font-semibold text-text-primary truncate max-w-[180px] text-right">
                {character.appearance?.wardrobeContext || character.groups[0] || "Nghệ nhân chế tác"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-text-muted">Tính cách nổi bật</span>
              <span className="font-semibold text-text-primary truncate max-w-[180px] text-right">
                {character.aliases.join(", ") || character.appearance?.hairstyle || "Kiên định, Tỉ mỉ"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border/80 pt-3 text-sm">
          <span className="text-text-muted">Trạng thái</span>
          <span className="flex items-center gap-1.5 rounded-md border border-badge-green-border bg-badge-green-bg px-2.5 py-0.5 text-xs font-bold text-badge-green">
            <span className="h-1.5 w-1.5 rounded-full bg-badge-green" />
            <span>Hoàn thiện</span>
          </span>
        </div>
      </div>

      {/* Card 2: Mô tả nhân vật */}
      <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-card p-5 shadow-lg">
        <div>
          <div className="flex items-center gap-2 border-b border-border/80 pb-3 text-sm font-bold text-text-primary">
            <FileText className="h-4 w-4 text-badge-orange" />
            <span>Mô tả nhân vật</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary min-h-[90px]">
            {shortDescription}
          </p>
        </div>

        <div className="border-t border-border/80 pt-3">
          <div className="text-xs font-bold text-text-muted mb-2">Từ khóa tính cách</div>
          <div className="flex flex-wrap gap-1.5">
            {displayKeywords.map((tag, idx) => (
              <span
                key={idx}
                className="rounded-md border border-badge-orange-border bg-badge-orange-bg px-2.5 py-0.5 text-xs font-semibold text-badge-orange"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Card 3: Quan hệ nhân vật */}
      <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-card p-5 shadow-lg">
        <div>
          <div className="flex items-center gap-2 border-b border-border/80 pb-3 text-sm font-bold text-text-primary">
            <Users className="h-4 w-4 text-badge-blue" />
            <span>Quan hệ nhân vật</span>
          </div>
          <div className="mt-3 space-y-2.5">
            {coCharacters.length > 0 ? (
              coCharacters.map((coChar, index) => {
                const relationTag =
                  index === 0
                    ? { label: "Thân thiết", badgeClass: "border-badge-orange-border bg-badge-orange-bg text-badge-orange" }
                    : index === 1
                      ? { label: "Đồng hành", badgeClass: "border-badge-blue-border bg-badge-blue-bg text-badge-blue" }
                      : { label: "Kính trọng", badgeClass: "border-badge-green-border bg-badge-green-bg text-badge-green" };

                return (
                  <div
                    key={coChar.assignmentId}
                    className="flex items-center justify-between rounded-lg border border-border/70 bg-surface-2 p-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-elevated text-sm font-bold text-primary-light">
                        {coChar.canonicalName.slice(0, 1).toLocaleUpperCase("vi")}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-text-primary">
                          {coChar.canonicalName}
                        </div>
                        <div className="text-xs text-text-muted truncate">
                          ({coChar.role || "Đồng hành"})
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-xs font-bold shrink-0 ${relationTag.badgeClass}`}
                    >
                      {relationTag.label}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-sm text-text-muted">
                Chưa có liên kết mối quan hệ với nhân vật khác.
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab("appearances")}
          className="mt-3 flex items-center justify-between border-t border-border/80 pt-3 text-sm font-semibold text-primary-light hover:text-primary transition-colors"
        >
          <span>Xem tất cả mối quan hệ</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Card 4: Visual references */}
      <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-card p-5 shadow-lg">
        <div>
          <div className="flex items-center gap-2 border-b border-border/80 pb-3 text-sm font-bold text-text-primary">
            <Camera className="h-4 w-4 text-badge-orange" />
            <span>Visual references</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-surface-elevated flex items-center justify-center text-text-dim hover:border-primary/50 transition-colors"
              >
                <div className="text-center">
                  <ImageIcon className="mx-auto h-4 w-4 text-text-dim" />
                  <span className="text-xs text-text-dim block mt-0.5">#{item}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab("visuals")}
          className="mt-3 flex items-center justify-between border-t border-border/80 pt-3 text-sm font-semibold text-primary-light hover:text-primary transition-colors"
        >
          <span>Xem tất cả visual</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Card 5: Xuất hiện trong scene */}
      <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-card p-5 shadow-lg">
        <div>
          <div className="flex items-center gap-2 border-b border-border/80 pb-3 text-sm font-bold text-text-primary">
            <Clapperboard className="h-4 w-4 text-badge-orange" />
            <span>Xuất hiện trong scene</span>
          </div>
          <div className="mt-3 space-y-2">
            {chapters.length > 0 ? (
              chapters.slice(0, 4).map((chapter, idx) => (
                <div
                  key={chapter.id}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-surface-2 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clapperboard className="h-3.5 w-3.5 shrink-0 text-text-dim" />
                    <span className="truncate font-medium text-text-primary">{chapter.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-md border border-badge-orange-border bg-badge-orange-bg px-2 py-0.5 text-xs font-bold text-badge-orange">
                      {roleBadge.label}
                    </span>
                    <span className="font-mono text-xs text-text-muted">
                      00:0{idx + 1}:{10 * (idx + 1)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-sm text-text-muted">
                Chưa có scene nào được liên kết trong dự án.
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab("appearances")}
          className="mt-3 flex items-center justify-between border-t border-border/80 pt-3 text-sm font-semibold text-primary-light hover:text-primary transition-colors"
        >
          <span>Xem tất cả scene</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Card 6: Prompt gợi ý / Ghi chú sáng tạo */}
      <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-card p-5 shadow-lg">
        <div>
          <div className="flex items-center gap-2 border-b border-border/80 pb-3 text-sm font-bold text-text-primary">
            <Lightbulb className="h-4 w-4 text-badge-amber" />
            <span>Prompt gợi ý / ghi chú sáng tạo</span>
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-text-secondary list-disc list-inside">
            {promptLines.slice(0, 4).map((line, idx) => (
              <li key={idx} className="line-clamp-2">
                {line}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab("notes")}
          className="mt-3 flex items-center gap-1.5 border-t border-border/80 pt-3 text-sm font-semibold text-primary-light hover:text-primary transition-colors"
        >
          <Edit3 className="h-3.5 w-3.5" />
          <span>Chỉnh sửa ghi chú</span>
        </button>
      </div>
    </div>
  );
}
