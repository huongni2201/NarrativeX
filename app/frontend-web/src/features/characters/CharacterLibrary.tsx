"use client";

import { useMemo, useState } from "react";
import { LoaderCircle, RefreshCw, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { apiErrorMessage } from "@/shared/api/client";
import { useCharactersQuery } from "./hooks/useCharactersQuery";

export function CharacterLibrary() {
  const [search, setSearch] = useState("");
  const query = useCharactersQuery();

  const characters = useMemo(
    () => query.data?.pages.flatMap((page) => page.content) ?? [],
    [query.data],
  );
  const visibleCharacters = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    if (!normalizedSearch) return characters;
    return characters.filter((character) =>
      [character.canonicalName, ...character.aliases]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedSearch),
    );
  }, [characters, search]);

  if (query.isPending) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-slate-400">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
        Đang tải thư viện nhân vật...
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-red-500/20 bg-red-950/10 p-6 text-center">
        <h2 className="text-lg font-semibold text-slate-100">Không thể tải thư viện nhân vật</h2>
        <p className="mt-2 text-sm text-slate-400">
          {apiErrorMessage(query.error, "Đã có lỗi khi gọi API thư viện nhân vật.")}
        </p>
        <Button className="mt-5" onClick={() => query.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-purple-300">
            <Users className="h-5 w-5" />
            <span className="text-sm font-medium">Character Library</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-100">Thư viện nhân vật</h1>
          <p className="mt-1 text-sm text-slate-400">
            {characters.length} nhân vật đã tải từ tài khoản hiện tại.
          </p>
        </div>

        <label className="relative block w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên hoặc alias..."
            className="h-10 w-full rounded-xl border border-slate-800 bg-[#0b101b] pl-9 pr-3 text-sm text-slate-100 outline-none transition focus:border-purple-500"
          />
        </label>
      </div>

      {visibleCharacters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0b101b]/60 px-6 py-16 text-center">
          <Users className="mx-auto h-10 w-10 text-slate-600" />
          <h2 className="mt-4 font-medium text-slate-200">
            {characters.length === 0 ? "Chưa có nhân vật" : "Không tìm thấy nhân vật"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {characters.length === 0
              ? "Nhân vật được phân tích từ story sẽ xuất hiện tại đây."
              : "Thử tìm bằng tên chính hoặc alias khác."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleCharacters.map((character) => (
            <article
              key={character.id}
              className="rounded-2xl border border-slate-800/80 bg-[#0b101b] p-5 shadow-lg transition hover:border-purple-500/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-slate-100">{character.canonicalName}</h2>
                  <p className="mt-1 text-xs text-slate-500">ID #{character.id}</p>
                </div>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
                  {character.status}
                </span>
              </div>

              <div className="mt-4 min-h-12">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Aliases</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {character.aliases.length > 0 ? (
                    character.aliases.map((alias) => (
                      <span
                        key={alias}
                        className="rounded-md border border-purple-800/30 bg-purple-950/30 px-2 py-1 text-xs text-purple-300"
                      >
                        {alias}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-600">Chưa có alias</span>
                  )}
                </div>
              </div>

              <div className="mt-5 border-t border-slate-800/70 pt-3 text-xs text-slate-500">
                <span>Version {character.rowVersion}</span>
                {character.workspaceId && <span> · Workspace {character.workspaceId}</span>}
              </div>
            </article>
          ))}
        </div>
      )}

      {query.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="secondary"
            disabled={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
          >
            {query.isFetchingNextPage && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Tải thêm
          </Button>
        </div>
      )}
    </section>
  );
}
