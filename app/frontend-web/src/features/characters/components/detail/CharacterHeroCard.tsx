"use client";

import { BookOpen, Calendar, Clock, Image as ImageIcon, Sparkles } from "lucide-react";
import type { ApiProjectCharacterDetail } from "@/features/characters/api/characters.api";
import { formatDateOnly, formatDateTime } from "./character-detail.types";

interface CharacterHeroCardProps {
  character: ApiProjectCharacterDetail;
  roleBadge: { label: string; className: string };
  isComplete: boolean;
  shortDescription: string;
  assetCount: number;
  completionPercentage: number;
}

export function CharacterHeroCard({
  character,
  roleBadge,
  isComplete,
  shortDescription,
  assetCount,
  completionPercentage,
}: Readonly<CharacterHeroCardProps>) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-card p-6 shadow-xl">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] items-start">
        {/* Hero Left: Portrait & Character Details */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch">
          {/* Cinematic Portrait */}
          <div className="relative h-44 w-36 sm:h-48 sm:w-40 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-lg">
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-surface-3/60 via-surface-card to-background text-3xl font-black text-primary-light">
              {character.canonicalName.slice(0, 1).toLocaleUpperCase("vi")}
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-dark via-transparent to-transparent opacity-60" />
          </div>

          {/* Profile Info */}
          <div className="flex min-w-0 flex-1 flex-col justify-between space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary">
                  {character.canonicalName}
                </h1>
                <span
                  className={`inline-block rounded-md border px-2.5 py-0.5 text-xs font-bold ${roleBadge.className}`}
                >
                  {roleBadge.label}
                </span>
                <span
                  className={`inline-block rounded-md border px-2.5 py-0.5 text-xs font-semibold ${
                    isComplete
                      ? "border-badge-green-border bg-badge-green-bg text-badge-green"
                      : "border-badge-amber-border bg-badge-amber-bg text-badge-amber"
                  }`}
                >
                  {isComplete ? "Hoàn thiện" : "Đang phát triển"}
                </span>
              </div>

              {/* Bio snippet */}
              <p className="mt-2 text-sm sm:text-base leading-relaxed text-text-secondary line-clamp-3">
                {shortDescription}
              </p>

              {/* Dates */}
              <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-text-muted">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-text-dim" />
                  <span>Tạo ngày: {formatDateOnly(character.createdAt)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-text-dim" />
                  <span>Cập nhật: {formatDateTime(character.updatedAt)}</span>
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-4">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-hover shadow-md shadow-primary/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Tạo visual</span>
              </button>
            </div>
          </div>
        </div>

        {/* Hero Right: 3 Stats Widgets */}
        <div className="grid grid-cols-3 gap-3">
          {/* Stat 1: Scenes */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-2 p-3.5 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary-muted text-primary-light">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="mt-2 text-xl font-extrabold text-text-primary">{character.sceneCount}</div>
            <div className="text-xs font-medium text-text-muted">Scene xuất hiện</div>
          </div>

          {/* Stat 2: Assets */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-2 p-3.5 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-badge-purple-border bg-badge-purple-bg text-badge-purple">
              <ImageIcon className="h-4 w-4" />
            </div>
            <div className="mt-2 text-xl font-extrabold text-text-primary">{assetCount}</div>
            <div className="text-xs font-medium text-text-muted">Visual assets</div>
          </div>

          {/* Stat 3: Circular Radial Gauge */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-2 p-3.5 text-center">
            <div className="relative flex h-11 w-11 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-surface-3"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-primary transition-colors duration-1000 ease-out"
                  strokeDasharray={`${completionPercentage}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-xs font-black text-text-primary">
                {completionPercentage}%
              </span>
            </div>
            <div className="mt-1 text-xs font-medium text-text-muted">Hoàn thiện hồ sơ</div>
          </div>
        </div>
      </div>
    </div>
  );
}
