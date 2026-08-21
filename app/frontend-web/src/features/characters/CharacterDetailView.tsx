"use client";

import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  FileText,
  Fingerprint,
  Layers3,
  Tag,
  UserRound,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { charactersApi } from "@/features/characters/api/characters.api";
import { projectsApi } from "@/features/projects/api/projects.api";
import { queryKeys } from "@/lib/query-keys";

interface CharacterDetailViewProps {
  characterId: number;
  projectId?: number;
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function DataRow({ label, value }: Readonly<{ label: string; value: string | number | null | undefined }>) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-800/70 py-3 last:border-b-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="max-w-[65%] text-right text-sm font-medium text-slate-200">
        {value === null || value === undefined || value === "" ? "—" : value}
      </dd>
    </div>
  );
}

export function CharacterDetailView({
  characterId,
  projectId,
}: Readonly<CharacterDetailViewProps>) {
  const projectDetailQuery = useQuery({
    queryKey: projectId
      ? queryKeys.projectCharacter(projectId, characterId)
      : ["projects", "invalid", "characters", characterId],
    queryFn: () => charactersApi.getProjectDetail(projectId!, characterId),
    enabled: Boolean(projectId),
  });

  const projectQuery = useQuery({
    queryKey: projectId ? queryKeys.project(projectId) : ["projects", "invalid"],
    queryFn: () => projectsApi.getById(projectId!),
    enabled: Boolean(projectId),
  });

  const globalCharactersQuery = useQuery({
    queryKey: queryKeys.characters,
    queryFn: () => charactersApi.list({ limit: 100 }),
    enabled: !projectId,
  });

  if (projectId && projectDetailQuery.isPending) {
    return <CharacterDetailSkeleton />;
  }

  if (projectId && projectDetailQuery.isError) {
    return (
      <div className="rounded-2xl border border-red-900/60 bg-red-950/20 p-8">
        <h1 className="text-lg font-bold text-red-100">Không tải được chi tiết nhân vật</h1>
        <p className="mt-2 text-sm text-red-300/70">
          Màn hình không dùng dữ liệu fallback. Hãy thử tải lại dữ liệu từ backend.
        </p>
        <button
          type="button"
          onClick={() => projectDetailQuery.refetch()}
          className="mt-4 rounded-lg border border-red-800 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-950/50"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!projectId) {
    if (globalCharactersQuery.isPending) return <CharacterDetailSkeleton />;
    if (globalCharactersQuery.isError) {
      return (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/20 p-8 text-red-200">
          Không tải được nhân vật từ Character Library.
        </div>
      );
    }

    const globalCharacter = globalCharactersQuery.data?.content.find(
      (character) => character.id === characterId,
    );
    if (!globalCharacter) {
      return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-8 text-slate-300">
          Không tìm thấy nhân vật.
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
          <Link href="/characters" className="hover:text-purple-300">
            Nhân vật
          </Link>
          <span className="mx-2 text-slate-600">/</span>
          <span className="text-slate-200">{globalCharacter.canonicalName}</span>
        </nav>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h1 className="text-2xl font-bold text-white">{globalCharacter.canonicalName}</h1>
          <p className="mt-2 text-sm text-slate-400">
            Đây là global Character Library summary. Dữ liệu project-specific chỉ xuất hiện khi mở nhân vật từ một project.
          </p>
          <dl className="mt-5 max-w-2xl">
            <DataRow label="Status" value={globalCharacter.status} />
            <DataRow label="Aliases" value={globalCharacter.aliases.join(", ")} />
            <DataRow label="Workspace" value={globalCharacter.workspaceId} />
            <DataRow label="Row version" value={globalCharacter.rowVersion} />
          </dl>
        </section>
      </div>
    );
  }

  const character = projectDetailQuery.data;
  if (!character) return null;

  const projectName = projectQuery.data?.name;
  const aliases = [...character.projectAliases, ...character.aliases];

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <Link href="/projects" className="hover:text-purple-300">
          Dự án
        </Link>
        <span className="text-slate-600">/</span>
        <Link href={`/projects/${projectId}`} className="hover:text-purple-300">
          {projectName ?? `Project ${projectId}`}
        </Link>
        <span className="text-slate-600">/</span>
        <span className="text-slate-200">{character.canonicalName}</span>
      </nav>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-lg font-bold text-slate-200">
                {character.canonicalName.slice(0, 1).toLocaleUpperCase("vi")}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{character.canonicalName}</h1>
                <p className="mt-0.5 text-sm font-semibold text-purple-300">{character.role}</p>
              </div>
            </div>
            {aliases.length > 0 && (
              <p className="mt-4 text-sm text-slate-400">Alias: {aliases.join(", ")}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Scene xuất hiện" value={character.sceneCount} icon={<BookOpen className="h-4 w-4" />} />
            <Metric label="Importance" value={character.importance} icon={<Layers3 className="h-4 w-4" />} />
            <Metric
              label="Pinned version"
              value={character.pinnedCharacterVersionId ?? "—"}
              icon={<Fingerprint className="h-4 w-4" />}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <UserRound className="h-4 w-4 text-purple-400" aria-hidden="true" />
            <h2 className="font-bold text-slate-100">Project assignment</h2>
          </div>
          <dl className="mt-2">
            <DataRow label="Role" value={character.role} />
            <DataRow label="Importance" value={character.importance} />
            <DataRow label="Project aliases" value={character.projectAliases.join(", ")} />
            <DataRow label="Groups" value={character.groups.join(", ")} />
            <DataRow label="Status" value={character.status} />
            <DataRow label="Assignment ID" value={character.assignmentId} />
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <FileText className="h-4 w-4 text-indigo-400" aria-hidden="true" />
            <h2 className="font-bold text-slate-100">Pinned CharacterVersion</h2>
          </div>
          {character.version ? (
            <dl className="mt-2">
              <DataRow label="Version" value={character.version.versionNumber} />
              <DataRow label="Status" value={character.version.status} />
              <DataRow label="Master asset ID" value={character.version.masterAssetId} />
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Project chưa pin CharacterVersion. Không có dữ liệu giả được hiển thị thay thế.
            </p>
          )}

          {character.version?.bible && (
            <div className="mt-4 border-t border-slate-800 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Bible</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {character.version.bible}
              </p>
            </div>
          )}

          {character.version?.visualPrompt && (
            <div className="mt-4 border-t border-slate-800 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Visual prompt</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {character.version.visualPrompt}
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Tag className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <h2 className="font-bold text-slate-100">Appearance</h2>
          </div>
          {character.appearance ? (
            <dl className="mt-2">
              <DataRow label="Age state" value={character.appearance.ageState} />
              <DataRow label="Hairstyle" value={character.appearance.hairstyle} />
              <DataRow label="Injury" value={character.appearance.injury} />
              <DataRow label="Wardrobe" value={character.appearance.wardrobeContext} />
              <DataRow label="Appearance prompt" value={character.appearance.appearancePrompt} />
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Chưa có appearance authoritative cho project này.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <CalendarClock className="h-4 w-4 text-sky-400" aria-hidden="true" />
            <h2 className="font-bold text-slate-100">Metadata</h2>
          </div>
          <dl className="mt-2">
            <DataRow label="Tạo" value={formatDate(character.createdAt)} />
            <DataRow label="Cập nhật" value={formatDate(character.updatedAt)} />
            <DataRow label="Row version" value={character.rowVersion} />
            <DataRow label="Workspace" value={character.workspaceId} />
          </dl>
        </section>
      </div>

      <section className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-5 text-sm text-slate-500">
        Asset count, avatar URL, relationships và scene detail chưa được hiển thị vì backend chưa có read-model authoritative cho các field đó. UI sẽ không suy diễn hoặc dùng fixture để lấp chỗ trống.
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
}: Readonly<{ label: string; value: string | number; icon: React.ReactNode }>) {
  return (
    <div className="min-w-32 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-center gap-1.5 text-slate-500">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <div className="mt-2 font-mono text-lg font-bold text-slate-100">{value}</div>
    </div>
  );
}

function CharacterDetailSkeleton() {
  return (
    <div className="space-y-5" aria-label="Đang tải chi tiết nhân vật">
      <div className="h-5 w-72 animate-pulse rounded bg-slate-800" />
      <div className="h-52 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
      <div className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-64 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
        ))}
      </div>
    </div>
  );
}
