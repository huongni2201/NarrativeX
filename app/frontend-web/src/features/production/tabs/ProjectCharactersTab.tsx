"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Library, Search, UserRound, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { charactersApi } from "@/features/characters/api/characters.api";
import { queryKeys } from "@/lib/query-keys";

interface ProjectCharactersTabProps {
  projectId: number;
  onOpenLibrary: () => void;
}

function roleLabel(role: string): string {
  const normalized = role.trim().toUpperCase();
  if (normalized === "MAIN" || normalized === "PROTAGONIST") return "Chính";
  if (normalized === "SUPPORTING" || normalized === "SECONDARY") return "Phụ";
  if (normalized === "ANTAGONIST") return "Đối trọng";
  return role;
}

export function ProjectCharactersTab({
  projectId,
  onOpenLibrary,
}: Readonly<ProjectCharactersTabProps>) {
  const [searchQuery, setSearchQuery] = useState("");

  const charactersQuery = useQuery({
    queryKey: queryKeys.projectCharacters(projectId),
    queryFn: () => charactersApi.listProject(projectId, { limit: 100 }),
  });

  const characters = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("vi");
    const content = charactersQuery.data?.content ?? [];
    if (!query) return content;

    return content.filter((character) => {
      const searchable = [
        character.canonicalName,
        character.role,
        ...character.aliases,
        ...character.projectAliases,
        ...character.groups,
      ]
        .join(" ")
        .toLocaleLowerCase("vi");
      return searchable.includes(query);
    });
  }, [charactersQuery.data?.content, searchQuery]);

  return (
    <section className="space-y-5" aria-labelledby="project-characters-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-400" aria-hidden="true" />
            <h2 id="project-characters-heading" className="text-lg font-bold text-white">
              Nhân vật dự án
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Dữ liệu bên dưới được lấy trực tiếp từ character assignment của dự án.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenLibrary}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-purple-500/50 hover:text-white"
        >
          <Library className="h-4 w-4" aria-hidden="true" />
          Mở thư viện nhân vật
        </button>
      </div>

      <div className="relative max-w-xl">
        <label htmlFor="project-character-search" className="sr-only">
          Tìm nhân vật trong dự án
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        />
        <input
          id="project-character-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Tìm theo tên, alias, role hoặc group..."
          className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-purple-500"
        />
      </div>

      {charactersQuery.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Đang tải nhân vật">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70"
            />
          ))}
        </div>
      ) : charactersQuery.isError ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/20 p-6">
          <h3 className="font-semibold text-red-200">Không tải được danh sách nhân vật</h3>
          <p className="mt-1 text-sm text-red-300/70">
            Không có dữ liệu demo thay thế. Hãy thử tải lại dữ liệu từ backend.
          </p>
          <button
            type="button"
            onClick={() => charactersQuery.refetch()}
            className="mt-4 rounded-lg border border-red-800 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-950/50"
          >
            Thử lại
          </button>
        </div>
      ) : (charactersQuery.data?.content.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-10 text-center">
          <UserRound className="mx-auto h-9 w-9 text-slate-600" aria-hidden="true" />
          <h3 className="mt-3 font-semibold text-slate-200">Dự án chưa có nhân vật</h3>
          <p className="mt-1 text-sm text-slate-500">
            Thêm hoặc gán nhân vật từ thư viện để bắt đầu.
          </p>
          <button
            type="button"
            onClick={onOpenLibrary}
            className="mt-4 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
          >
            Mở thư viện nhân vật
          </button>
        </div>
      ) : characters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
          Không có nhân vật khớp với tìm kiếm.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {characters.map((character) => (
            <Link
              key={character.assignmentId}
              href={`/projects/${projectId}/characters/${character.id}`}
              className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition-colors hover:border-purple-500/50 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-slate-100 group-hover:text-white">
                    {character.canonicalName}
                  </h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-purple-300">
                    {roleLabel(character.role)}
                  </p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-sm font-bold text-slate-300">
                  {character.canonicalName.slice(0, 1).toLocaleUpperCase("vi")}
                </div>
              </div>

              {(character.projectAliases.length > 0 || character.aliases.length > 0) && (
                <p className="mt-4 line-clamp-2 text-sm text-slate-400">
                  Alias: {[...character.projectAliases, ...character.aliases].join(", ")}
                </p>
              )}

              <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-800 pt-4 text-center">
                <div>
                  <dt className="text-[11px] text-slate-500">Scene</dt>
                  <dd className="mt-1 flex items-center justify-center gap-1 font-mono text-sm font-semibold text-slate-200">
                    <BookOpen className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    {character.sceneCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">Importance</dt>
                  <dd className="mt-1 font-mono text-sm font-semibold text-slate-200">
                    {character.importance}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">Pinned</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-200">
                    {character.pinnedCharacterVersionId ? "Có" : "—"}
                  </dd>
                </div>
              </dl>

              {character.groups.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {character.groups.map((group) => (
                    <span
                      key={group}
                      className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400"
                    >
                      {group}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
