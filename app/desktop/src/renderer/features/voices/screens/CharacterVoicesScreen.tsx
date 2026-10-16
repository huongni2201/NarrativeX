import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Loader2, Mic2, Search } from "lucide-react";
import type { DesktopCharacter } from "../../../../shared/api-types";
import type { DesktopCharacterVoiceProfiles } from "../../../../shared/api-types/character";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toErrorMessage } from "@/lib/errors";
import { EmptyState } from "../../workspace/components/FeaturePage";
import { characterVoiceReady, currentCharacterVoice } from "../model/character-voice";
import { useCharacterVoiceProfiles, useSaveCharacterVoice } from "../queries/character-voice.queries";

export function CharacterVoicesScreen({ projectId, characters, loading }: Readonly<{
  projectId: string; characters: DesktopCharacter[]; loading: boolean;
}>) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const selected = characters.find(character => character.id === params.get("characterId")) ?? characters[0];
  const filtered = characters.filter(character => character.canonicalName.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  if (!characters.length) return loading ? <p role="status" className="p-6 text-body text-text-muted">Đang tải nhân vật…</p> :
    <div className="p-6"><EmptyState title="Chưa có nhân vật" description="Phân tích chương hoặc thêm nhân vật trong Hồ sơ trước khi thiết lập giọng." icon={Mic2} /></div>;
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(220px,300px)_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-r border-border-subtle bg-surface-dark">
        <div className="border-b border-border-subtle p-4">
          <h1 className="text-[17px] font-semibold text-foreground">Giọng nhân vật</h1>
          <p className="mt-1 text-caption text-text-muted">{characters.length} nhân vật trong dự án</p>
          <label className="relative mt-3 block">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input aria-label="Tìm nhân vật để thiết lập giọng" placeholder="Tìm nhân vật…" value={search} onChange={event => setSearch(event.target.value)} className="pl-8" />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {filtered.length ? filtered.map(character => <CharacterVoiceRow key={character.id} character={character} selected={selected?.id === character.id}
            onSelect={() => setParams(previous => { const next = new URLSearchParams(previous); next.set("characterId", character.id); return next; })} />) :
            <p role="status" className="p-3 text-caption text-text-muted">Không tìm thấy nhân vật.</p>}
        </div>
      </aside>
      {selected && <CharacterVoiceDetail key={`${projectId}:${selected.id}`} character={selected} />}
    </div>
  );
}

function CharacterVoiceRow({ character, selected, onSelect }: Readonly<{ character: DesktopCharacter; selected: boolean; onSelect(): void }>) {
  const query = useCharacterVoiceProfiles(character.id);
  const ready = characterVoiceReady(query.data);
  return <button type="button" onClick={onSelect} aria-pressed={selected}
    className={`mb-1 flex min-h-16 w-full items-center gap-3 rounded-md border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-primary/40 bg-primary-muted" : "border-transparent hover:bg-surface-hover"}`}>
    <Mic2 size={17} className={ready ? "shrink-0 text-primary" : "shrink-0 text-text-muted"} />
    <span className="min-w-0 flex-1"><span className="block truncate text-body font-medium text-foreground">{character.canonicalName}</span>
      <span className={`mt-1 block text-caption ${ready ? "text-success" : "text-text-muted"}`}>{query.isLoading ? "Đang tải giọng…" : query.isError ? "Không tải được giọng" : ready ? "Đã thiết lập giọng" : "Chưa thiết lập giọng"}</span>
    </span>
    {ready && <Check size={15} className="shrink-0 text-success" />}
  </button>;
}

function CharacterVoiceDetail({ character }: Readonly<{ character: DesktopCharacter }>) {
  const query = useCharacterVoiceProfiles(character.id);
  return <section className="min-w-0 overflow-y-auto p-6 lg:p-8">
    <div className="mx-auto max-w-2xl">
      <h2 className="text-[20px] font-semibold text-foreground">{character.canonicalName}</h2>
      <p className="mt-2 text-body leading-relaxed text-text-secondary">Mô tả chất giọng để các câu thoại của nhân vật nhất quán. Hồ sơ này dùng chung cho các dự án có nhân vật này.</p>
      {query.isLoading ? <p role="status" className="mt-6 text-body text-text-muted">Đang tải hồ sơ giọng…</p> : query.isError ?
        <div role="alert" className="mt-6 rounded-lg border border-destructive/30 bg-danger-bg p-4 text-body text-destructive">
          Không tải được hồ sơ giọng. <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Thử lại</Button>
        </div> : query.data ? <VoiceProfileForm character={character} state={query.data} /> : null}
    </div>
  </section>;
}

function VoiceProfileForm({ character, state }: Readonly<{ character: DesktopCharacter; state: DesktopCharacterVoiceProfiles }>) {
  const current = currentCharacterVoice(state);
  const save = useSaveCharacterVoice(character.id);
  const [language, setLanguage] = useState(current?.language ?? "vi-VN");
  const [accent, setAccent] = useState(current?.accent ?? "");
  const [description, setDescription] = useState(current?.voiceDescription ?? "");
  const [delivery, setDelivery] = useState(current?.deliveryBaseline ?? "");
  const [baseVersion, setBaseVersion] = useState(state.characterRowVersion);
  const [notice, setNotice] = useState<string | null>(null);
  const ready = characterVoiceReady(state);
  const dirty = language !== (current?.language ?? "vi-VN") || accent !== (current?.accent ?? "") ||
    description !== (current?.voiceDescription ?? "") || delivery !== (current?.deliveryBaseline ?? "");
  function reset() {
    setLanguage(current?.language ?? "vi-VN"); setAccent(current?.accent ?? "");
    setDescription(current?.voiceDescription ?? ""); setDelivery(current?.deliveryBaseline ?? "");
    setBaseVersion(state.characterRowVersion); setNotice(null); save.reset();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!description.trim() || !language.trim() || save.isPending || !dirty) return;
    setNotice(null);
    try {
      await save.mutateAsync({ expectedRowVersion: baseVersion, language: language.trim(), accent: accent.trim(), voiceDescription: description.trim(), deliveryBaseline: delivery.trim() });
      setBaseVersion(baseVersion + 1);
      setDescription(description.trim()); setAccent(accent.trim()); setLanguage(language.trim()); setDelivery(delivery.trim());
      setNotice("Đã lưu và đặt làm giọng đang dùng cho nhân vật.");
    } catch { /* The mutation error is rendered below; keep the draft. */ }
  }
  return <form onSubmit={event => void submit(event)} className="mt-6 space-y-5">
    <div className={`rounded-lg border p-4 text-body ${ready ? "border-success/30 bg-success-bg text-success" : "border-warning/30 bg-warning-bg text-warning"}`}>
      {ready ? `Đang dùng hồ sơ giọng phiên bản ${current?.versionNumber}.` : "Chưa có giọng cho nhân vật này. Các cảnh có lời thoại sẽ chờ đến khi bạn lưu hồ sơ giọng."}
    </div>
    <fieldset disabled={save.isPending || character.status === "ARCHIVED"} className="space-y-5 disabled:opacity-60">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-body text-text-secondary">Ngôn ngữ
          <Input required maxLength={16} value={language} onChange={event => setLanguage(event.target.value)} placeholder="vi-VN" />
        </label>
        <label className="grid gap-2 text-body text-text-secondary">Vùng giọng <span className="sr-only">(không bắt buộc)</span>
          <Input maxLength={64} value={accent} onChange={event => setAccent(event.target.value)} placeholder="Ví dụ: miền Bắc" />
        </label>
      </div>
      <label className="grid gap-2 text-body text-text-secondary">Mô tả giọng nói <span className="sr-only">(bắt buộc)</span>
        <Textarea required maxLength={2000} rows={5} value={description} onChange={event => setDescription(event.target.value)} placeholder="Ví dụ: giọng trầm, ấm, phát âm rõ, tốc độ vừa phải." aria-describedby="voice-description-help" />
        <span id="voice-description-help" className="text-caption leading-relaxed text-text-muted">Mô tả tuổi giọng, âm sắc, cao độ và đặc trưng phát âm. Không cần tải file giọng mẫu.</span>
      </label>
      <label className="grid gap-2 text-body text-text-secondary">Cách thể hiện mặc định
        <Textarea maxLength={2000} rows={3} value={delivery} onChange={event => setDelivery(event.target.value)} placeholder="Ví dụ: điềm tĩnh, nhịp nói chậm, nhấn nhẹ cuối câu." />
      </label>
      <p className="text-caption text-text-muted">Mỗi lần lưu tạo một phiên bản mới. Hồ sơ cũ được giữ lại; việc lưu chưa tạo âm thanh hay chạy AI.</p>
      {save.isError && <p role="alert" className="text-body text-destructive">{toErrorMessage(save.error, "Không lưu được hồ sơ giọng. Hãy thử lại.")}</p>}
      {notice && <p role="status" className="text-body text-success">{notice}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!dirty || !description.trim() || !language.trim() || save.isPending}>{save.isPending && <Loader2 size={15} className="animate-spin" />}Lưu hồ sơ giọng</Button>
        <Button type="button" variant="outline" onClick={reset}>Khôi phục bản đã lưu</Button>
      </div>
    </fieldset>
  </form>;
}
