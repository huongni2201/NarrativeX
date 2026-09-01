import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { DesktopCharacter, DesktopCharacterDetail } from "@narrativex/client-contracts";
import { Loader2, Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, FeaturePage } from "../../workspace/components/FeaturePage";
import {
  InlineNotice,
  PaneHeader,
  PropertyRow,
  StatusIndicator,
  WorkspacePane,
  WorkspaceToolbar,
} from "../../workspace/components/WorkstationPrimitives";
import { CharacterGeminiQueueBanner } from "../components/CharacterGeminiQueueBanner";
import { CharacterReferenceStudio } from "../components/CharacterReferenceStudio";
import { useCharacterGeminiQueue } from "../queries/character-gemini-queue";
import { useCharacterDetail, useCharacterPortrait, useCreateCharacter } from "../queries/characters.queries";

function normalizeLabel(value?: string | null) {
  return value ? value.replaceAll("_", " ") : "—";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function parseList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function CharacterPortrait({ src, alt, className }: Readonly<{ src: string | null; alt: string; className: string }>) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [src]);
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden bg-primary-muted ${className}`}>
      {src && !imageFailed ? (
        <img src={src} alt={alt} width={128} height={128} loading="lazy" className="size-full object-cover" onError={() => setImageFailed(true)} />
      ) : (
        <span className="px-2 text-center text-[9px] font-medium leading-4 text-text-dim">Chưa có ảnh</span>
      )}
    </div>
  );
}

function CharacterRow({ projectId, character, selected, onSelect }: Readonly<{
  projectId: string;
  character: DesktopCharacter;
  selected: boolean;
  onSelect: () => void;
}>) {
  const portraitQuery = useCharacterPortrait(projectId, character.id, character.pinnedCharacterVersionId ?? null);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group flex min-h-16 w-full items-center gap-2.5 border-l-2 border-b border-b-border-subtle px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 ${
        selected ? "border-l-primary bg-primary-muted/45" : "border-l-transparent hover:bg-surface-hover"
      }`}
    >
      <CharacterPortrait src={portraitQuery.url} alt={`Ảnh đại diện của ${character.canonicalName}`} className="size-11 rounded-md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-[11px] font-semibold ${selected ? "text-primary-hover" : "text-foreground"}`}>{character.canonicalName}</span>
          <StatusIndicator label={normalizeLabel(character.status ?? "ACTIVE")} tone="success" className="shrink-0" />
        </div>
        <div className="mt-0.5 truncate text-[9px] text-text-muted">{normalizeLabel(character.role ?? "Project character")}</div>
        <div className="mt-1 flex items-center gap-2 text-[9px] text-text-dim">
          <span>{character.sceneCount ?? 0} scenes</span>
          <span>·</span>
          <span>{character.pinnedCharacterVersionId ? "Reference ready" : "Reference unlocked"}</span>
        </div>
      </div>
    </button>
  );
}

export function CharactersScreen({ projectId, characters }: Readonly<{ projectId: string; characters: DesktopCharacter[] }>) {
  const createCharacter = useCreateCharacter(projectId);
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(characters[0]?.id ?? null);
  const {
    geminiQueue,
    generatingCharacterId,
    currentQueueCharacter,
    queueProcessedCount,
    geminiQueueActive,
    startGeminiAll,
    resumeGeminiAll,
    skipCurrentGeminiCharacter,
    stopGeminiAll,
    dismissGeminiQueue,
  } = useCharacterGeminiQueue(projectId, characters, {
    onNotice: setNotice,
    onSelectCharacter: setSelectedId,
  });

  useEffect(() => {
    if (!characters.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !characters.some((character) => character.id === selectedId)) setSelectedId(characters[0].id);
  }, [characters, selectedId]);

  const filteredCharacters = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return characters;
    return characters.filter((character) =>
      [character.canonicalName, character.role, character.status, ...(character.aliases ?? []), ...(character.projectAliases ?? []), ...(character.groups ?? [])]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(query)),
    );
  }, [characters, search]);

  const selectedSummary = characters.find((character) => character.id === selectedId) ?? null;
  const detailQuery = useCharacterDetail(projectId, selectedId);
  const detail: DesktopCharacterDetail | null = detailQuery.data ?? (selectedSummary ? { ...selectedSummary, version: null, appearance: null } : null);
  const workingVersionId = detail?.version?.id ?? detail?.pinnedCharacterVersionId ?? null;
  const portraitQuery = useCharacterPortrait(projectId, selectedId, workingVersionId);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setNotice(null);
    try {
      const character = await createCharacter.mutateAsync({ canonicalName: name.trim(), aliases: parseList(aliases) });
      setName("");
      setAliases("");
      setCreating(false);
      setSelectedId(character.id);
      setNotice("Character đã được tạo và assign vào project.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể tạo character.");
    }
  }

  return (
    <FeaturePage
      title="Character Library"
      description="Canonical identity, reference approval và continuity cho project."
      contentClassName="min-h-0 overflow-hidden bg-background p-0"
    >
      <div className="flex h-full min-h-0 flex-col">
        <WorkspaceToolbar>
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm character, alias, vai trò…" className="pl-8" />
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" disabled={!characters.length || geminiQueueActive} onClick={() => void startGeminiAll()}>
              <Sparkles size={12} /> Generate All
            </Button>
            <Button size="sm" disabled={geminiQueueActive} onClick={() => setCreating((value) => !value)}>
              <Plus size={12} /> New Character
            </Button>
          </div>
        </WorkspaceToolbar>

        {creating ? (
          <form className="grid shrink-0 gap-2 border-b border-border-subtle bg-surface-panel p-2.5 md:grid-cols-[minmax(180px,.8fr)_minmax(260px,1.2fr)_auto]" onSubmit={(event) => void create(event)}>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Canonical name" aria-label="Canonical name" />
            <Input value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="Aliases, phân cách bằng dấu phẩy" aria-label="Aliases" />
            <div className="flex justify-end gap-1.5">
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={!name.trim() || createCharacter.isPending || geminiQueueActive}>
                {createCharacter.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {createCharacter.isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </form>
        ) : null}

        <CharacterGeminiQueueBanner
          queue={geminiQueue}
          currentCharacterName={currentQueueCharacter?.canonicalName ?? null}
          processedCount={queueProcessedCount}
          busy={Boolean(generatingCharacterId)}
          onStart={() => void startGeminiAll()}
          onResume={() => void resumeGeminiAll()}
          onSkip={() => void skipCurrentGeminiCharacter()}
          onStop={stopGeminiAll}
          onDismiss={dismissGeminiQueue}
        />

        {notice ? <InlineNotice>{notice}</InlineNotice> : null}

        {!characters.length ? (
          <EmptyState title="Chưa có character" description="Tạo nhân vật đầu tiên để xây identity reference và continuity." />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(240px,280px)_minmax(360px,1fr)_minmax(260px,300px)] overflow-hidden">
            <WorkspacePane className="flex flex-col border-r border-border-subtle bg-surface-panel">
              <PaneHeader title="Characters" meta={`${filteredCharacters.length} / ${characters.length}`} />
              <div className="min-h-0 flex-1 overflow-y-auto">
                {filteredCharacters.map((character) => (
                  <CharacterRow key={character.id} projectId={projectId} character={character} selected={character.id === selectedId} onSelect={() => setSelectedId(character.id)} />
                ))}
                {!filteredCharacters.length ? <div className="p-4 text-center text-[10px] text-text-muted">Không có character phù hợp.</div> : null}
              </div>
            </WorkspacePane>

            <WorkspacePane className="flex min-w-0 flex-col border-r border-border-subtle">
              {!detail ? (
                <div className="grid h-full place-items-center text-[10px] text-text-muted">Chọn một nhân vật để mở Character Studio.</div>
              ) : (
                <>
                  <PaneHeader
                    title={detail.canonicalName}
                    meta={`${normalizeLabel(detail.role)} · ${detail.sceneCount ?? 0} scene appearances`}
                    actions={detailQuery.isFetching ? <span className="text-[9px] text-text-dim">Refreshing…</span> : undefined}
                  />
                  {detailQuery.isError ? <InlineNotice tone="danger">Không tải được dữ liệu chi tiết. Đang hiển thị dữ liệu tóm tắt.</InlineNotice> : null}
                  <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    <div className="mb-3 flex items-center gap-3 border-b border-border-subtle pb-3">
                      <CharacterPortrait src={portraitQuery.url} alt={`Ảnh đại diện của ${detail.canonicalName}`} className="size-16 rounded-md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-[15px] font-semibold text-foreground">{detail.canonicalName}</h2>
                          <StatusIndicator label={normalizeLabel(detail.status ?? "ACTIVE")} tone="success" />
                        </div>
                        <p className="mt-1 text-[10px] text-text-muted">
                          {portraitQuery.isLoading || portraitQuery.isReferencesLoading ? "Đang tải identity…" : portraitQuery.url ? "Identity reference ready" : "No identity reference"}
                        </p>
                      </div>
                    </div>
                    <CharacterReferenceStudio projectId={projectId} character={detail} generationLocked={geminiQueueActive} />
                  </div>
                </>
              )}
            </WorkspacePane>

            <WorkspacePane className="flex flex-col bg-surface-panel">
              <PaneHeader title="Inspector" meta={detail ? normalizeLabel(detail.status ?? "ACTIVE") : "No selection"} />
              {!detail ? (
                <div className="p-4 text-[10px] text-text-muted">Chọn character để xem identity, version và appearance.</div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <InspectorSection title="Identity">
                    <PropertyRow label="Canonical" value={<span className="block truncate">{detail.canonicalName}</span>} />
                    <PropertyRow label="Aliases" value={detail.aliases?.length ? detail.aliases.join(", ") : "—"} />
                    <PropertyRow label="Project aliases" value={detail.projectAliases?.length ? detail.projectAliases.join(", ") : "—"} />
                    <PropertyRow label="Role" value={normalizeLabel(detail.role)} />
                    <PropertyRow label="Importance" value={detail.importance ?? 0} />
                    <PropertyRow label="Scenes" value={detail.sceneCount ?? 0} />
                  </InspectorSection>
                  <InspectorSection title="Version">
                    <PropertyRow label="Version" value={detail.version?.versionNumber ?? "—"} />
                    <PropertyRow label="Status" value={normalizeLabel(detail.version?.status)} />
                    <PropertyRow label="Pinned" value={detail.version && detail.pinnedCharacterVersionId === detail.version.id ? "Yes" : "No"} />
                    <PropertyRow label="Updated" value={formatDate(detail.updatedAt)} />
                  </InspectorSection>
                  <InspectorSection title="Appearance">
                    <PropertyRow label="Age" value={detail.appearance?.ageState || "—"} />
                    <PropertyRow label="Hair" value={detail.appearance?.hairstyle || "—"} />
                    <PropertyRow label="Injury" value={detail.appearance?.injury || "—"} />
                    <PropertyRow label="Wardrobe" value={detail.appearance?.wardrobeContext || "—"} />
                  </InspectorSection>
                  <InspectorText title="Character bible" value={detail.version?.bible || "Chưa có character bible."} />
                  <InspectorText title="Visual prompt" value={detail.version?.visualPrompt || "Chưa có visual prompt."} />
                </div>
              )}
            </WorkspacePane>
          </div>
        )}
      </div>
    </FeaturePage>
  );
}

function InspectorSection({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="border-b border-border-subtle">
      <div className="bg-surface-dark px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-text-dim">{title}</div>
      {children}
    </section>
  );
}

function InspectorText({ title, value }: Readonly<{ title: string; value: string }>) {
  return (
    <section className="border-b border-border-subtle p-3">
      <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-text-dim">{title}</div>
      <p className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap text-[10px] leading-4 text-text-muted">{value}</p>
    </section>
  );
}
