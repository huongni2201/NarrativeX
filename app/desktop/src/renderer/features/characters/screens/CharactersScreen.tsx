import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type {
  DesktopCharacter,
  DesktopCharacterDetail,
} from "@narrativex/client-contracts";
import {
  BookOpen,
  CircleDot,
  LockKeyhole,
  Plus,
  Search,
  Shirt,
  Sparkles,
  Tags,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, FeaturePage } from "../../workspace/components/FeaturePage";
import { useCharacterDetail, useCreateCharacter } from "../queries/characters.queries";

function normalizeLabel(value?: string | null) {
  return value ? value.replaceAll("_", " ") : "—";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function statusDotClass(status?: string | null) {
  if (status === "REMOVED" || status === "ARCHIVED") return "bg-text-dim";
  return "bg-emerald-500";
}

function CharacterCard({
  character,
  selected,
  onSelect,
}: Readonly<{
  character: DesktopCharacter;
  selected: boolean;
  onSelect: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid min-w-0 grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/40 hover:bg-surface-panel"
      }`}
    >
      <div className="grid size-11 place-items-center rounded-lg bg-primary-muted text-primary-hover">
        <UserCircle size={25} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${statusDotClass(character.status)}`} />
          <span className="truncate text-[9px] font-medium uppercase tracking-[.12em] text-muted-foreground">
            {normalizeLabel(character.status ?? "ACTIVE")}
          </span>
        </div>
        <h2 className="mt-0.5 truncate text-sm font-semibold text-foreground">
          {character.canonicalName}
        </h2>
        <p className="truncate text-[10px] text-muted-foreground">
          {normalizeLabel(character.role ?? "Project character")}
        </p>
        <div className="mt-1.5 flex items-center gap-2 text-[9px] text-text-dim">
          <span>{character.sceneCount ?? 0} scenes</span>
          <span>·</span>
          <span>{character.pinnedCharacterVersionId ? "Version locked" : "No version locked"}</span>
        </div>
      </div>
    </button>
  );
}

function DetailRow({ label, value }: Readonly<{ label: string; value: ReactNode }>) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 border-b border-border-subtle py-2 last:border-b-0">
      <dt className="text-[10px] text-text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-[10px] font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function CharactersScreen({
  projectId,
  characters,
}: Readonly<{
  projectId: string;
  characters: DesktopCharacter[];
}>) {
  const createCharacter = useCreateCharacter(projectId);
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(characters[0]?.id ?? null);

  useEffect(() => {
    if (!characters.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !characters.some((character) => character.id === selectedId)) {
      setSelectedId(characters[0].id);
    }
  }, [characters, selectedId]);

  const filteredCharacters = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return characters;

    return characters.filter((character) =>
      [
        character.canonicalName,
        character.role,
        character.status,
        ...(character.aliases ?? []),
        ...(character.projectAliases ?? []),
        ...(character.groups ?? []),
      ]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(query)),
    );
  }, [characters, search]);

  const selectedSummary = characters.find((character) => character.id === selectedId) ?? null;
  const detailQuery = useCharacterDetail(projectId, selectedId);
  const detail: DesktopCharacterDetail | null =
    detailQuery.data ??
    (selectedSummary
      ? {
          ...selectedSummary,
          version: null,
          appearance: null,
        }
      : null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    setNotice(null);
    try {
      const character = await createCharacter.mutateAsync({
        canonicalName: name.trim(),
        aliases: parseList(aliases),
      });
      setName("");
      setAliases("");
      setSelectedId(character.id);
      setNotice("Character đã được tạo và assign vào project.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể tạo character.");
    }
  }

  return (
    <FeaturePage
      title="Character Library"
      description="Quản lý identity, vai trò trong project, phiên bản nhân vật và trạng thái ngoại hình theo timeline."
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
          <form className="flex min-w-0 flex-1 flex-wrap items-end gap-2" onSubmit={(event) => void create(event)}>
            <label className="grid min-w-[220px] flex-1 gap-1 text-[10px] text-muted-foreground">
              Canonical name
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tên nhân vật"
              />
            </label>
            <label className="grid min-w-[220px] flex-1 gap-1 text-[10px] text-muted-foreground">
              Aliases
              <Input
                value={aliases}
                onChange={(event) => setAliases(event.target.value)}
                placeholder="Tên gọi khác, phân cách bằng dấu phẩy"
              />
            </label>
            <Button type="submit" disabled={!name.trim() || createCharacter.isPending}>
              <Plus size={14} /> {createCharacter.isPending ? "Creating…" : "Create character"}
            </Button>
          </form>

          <div className="relative min-w-[240px] flex-[0_1_360px]">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên, alias, vai trò, nhóm…"
              className="pl-9"
            />
          </div>
        </div>

        {notice && <p className="px-1 text-[10px] text-muted-foreground">{notice}</p>}

        {!characters.length ? (
          <EmptyState title="Chưa có character" description="Tạo nhân vật đầu tiên bằng form phía trên." />
        ) : (
          <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(380px,0.85fr)_minmax(0,1.65fr)]">
            <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-lg border border-border bg-surface-dark p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xs font-semibold text-foreground">Characters</h2>
                  <p className="mt-0.5 text-[9px] text-text-muted">
                    {filteredCharacters.length} / {characters.length} nhân vật trong project
                  </p>
                </div>
              </div>

              <div className="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] content-start gap-2 overflow-auto pr-1 xl:grid-cols-1 2xl:grid-cols-2">
                {filteredCharacters.map((character) => (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    selected={character.id === selectedId}
                    onSelect={() => setSelectedId(character.id)}
                  />
                ))}
                {!filteredCharacters.length && (
                  <div className="col-span-full rounded-md border border-dashed border-border p-6 text-center text-[10px] text-text-muted">
                    Không tìm thấy nhân vật phù hợp.
                  </div>
                )}
              </div>
            </section>

            <section className="min-h-0 overflow-auto rounded-lg border border-border bg-card">
              {!detail ? (
                <div className="grid h-full min-h-64 place-items-center text-[10px] text-text-muted">
                  Chọn một nhân vật để xem chi tiết.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start gap-4 border-b border-border-subtle p-4">
                    <div className="grid size-20 shrink-0 place-items-center rounded-xl bg-primary-muted text-primary-hover">
                      <UserCircle size={44} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-semibold text-foreground">
                          {detail.canonicalName}
                        </h2>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-500">
                          {normalizeLabel(detail.status ?? "ACTIVE")}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-text-muted">
                        {normalizeLabel(detail.role)} · {detail.sceneCount ?? 0} scene appearances
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {detail.projectAliases?.map((alias) => (
                          <span
                            key={`project-${alias}`}
                            className="rounded-md border border-border bg-surface-panel px-2 py-1 text-[9px] text-text-muted"
                          >
                            {alias}
                          </span>
                        ))}
                        {detail.groups?.map((group) => (
                          <span
                            key={`group-${group}`}
                            className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-[9px] text-primary-hover"
                          >
                            {group}
                          </span>
                        ))}
                      </div>
                    </div>
                    {detailQuery.isFetching && (
                      <span className="text-[9px] text-text-dim">Refreshing…</span>
                    )}
                  </div>

                  {detailQuery.isError && (
                    <div className="border-b border-border-subtle bg-destructive/5 px-4 py-2 text-[10px] text-destructive">
                      Không tải được dữ liệu chi tiết. Đang hiển thị dữ liệu tóm tắt.
                    </div>
                  )}

                  <div className="grid gap-3 p-3 2xl:grid-cols-2">
                    <div className="rounded-lg border border-border bg-surface-dark p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Tags size={14} className="text-primary-hover" />
                        <h3 className="text-xs font-semibold">Project identity</h3>
                      </div>
                      <dl>
                        <DetailRow label="Canonical name" value={detail.canonicalName} />
                        <DetailRow
                          label="Global aliases"
                          value={detail.aliases?.length ? detail.aliases.join(", ") : "—"}
                        />
                        <DetailRow
                          label="Project aliases"
                          value={detail.projectAliases?.length ? detail.projectAliases.join(", ") : "—"}
                        />
                        <DetailRow label="Role" value={normalizeLabel(detail.role)} />
                        <DetailRow label="Importance" value={detail.importance ?? 0} />
                        <DetailRow
                          label="Groups"
                          value={detail.groups?.length ? detail.groups.join(", ") : "—"}
                        />
                        <DetailRow label="Scene count" value={detail.sceneCount ?? 0} />
                        <DetailRow label="Created" value={formatDate(detail.createdAt)} />
                        <DetailRow label="Updated" value={formatDate(detail.updatedAt)} />
                      </dl>
                    </div>

                    <div className="rounded-lg border border-border bg-surface-dark p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <LockKeyhole size={14} className="text-primary-hover" />
                        <h3 className="text-xs font-semibold">Pinned version</h3>
                      </div>
                      {detail.version ? (
                        <dl>
                          <DetailRow label="Version" value={detail.version.versionNumber ?? "—"} />
                          <DetailRow label="Status" value={normalizeLabel(detail.version.status)} />
                          <DetailRow
                            label="Pinned to project"
                            value={detail.pinnedCharacterVersionId ? "Yes" : "No"}
                          />
                        </dl>
                      ) : (
                        <p className="rounded-md border border-dashed border-border p-4 text-[10px] text-text-muted">
                          Chưa có phiên bản nhân vật được resolve cho project này.
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg border border-border bg-surface-dark p-3 2xl:col-span-2">
                      <div className="mb-2 flex items-center gap-2">
                        <BookOpen size={14} className="text-primary-hover" />
                        <h3 className="text-xs font-semibold">Character bible</h3>
                      </div>
                      <p className="whitespace-pre-wrap text-[10px] leading-5 text-text-muted">
                        {detail.version?.bible || "Chưa có character bible trong phiên bản hiện tại."}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-surface-dark p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Sparkles size={14} className="text-primary-hover" />
                        <h3 className="text-xs font-semibold">Visual prompt</h3>
                      </div>
                      <p className="whitespace-pre-wrap text-[10px] leading-5 text-text-muted">
                        {detail.version?.visualPrompt || "Chưa có visual prompt trong phiên bản hiện tại."}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-surface-dark p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Shirt size={14} className="text-primary-hover" />
                        <h3 className="text-xs font-semibold">Timeline appearance</h3>
                      </div>
                      {detail.appearance ? (
                        <dl>
                          <DetailRow label="Age state" value={detail.appearance.ageState || "—"} />
                          <DetailRow label="Hairstyle" value={detail.appearance.hairstyle || "—"} />
                          <DetailRow label="Injury" value={detail.appearance.injury || "—"} />
                          <DetailRow
                            label="Wardrobe context"
                            value={detail.appearance.wardrobeContext || "—"}
                          />
                        </dl>
                      ) : (
                        <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-4 text-[10px] text-text-muted">
                          <CircleDot size={13} /> Chưa có appearance state cho timeline hiện tại.
                        </div>
                      )}
                    </div>

                    {detail.appearance?.appearancePrompt && (
                      <div className="rounded-lg border border-border bg-surface-dark p-3 2xl:col-span-2">
                        <div className="mb-2 flex items-center gap-2">
                          <Sparkles size={14} className="text-primary-hover" />
                          <h3 className="text-xs font-semibold">Appearance prompt</h3>
                        </div>
                        <p className="whitespace-pre-wrap text-[10px] leading-5 text-text-muted">
                          {detail.appearance.appearancePrompt}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </FeaturePage>
  );
}
