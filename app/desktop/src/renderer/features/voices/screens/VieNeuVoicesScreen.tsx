import { useMemo, useState, type FormEvent } from "react";
import { AudioWaveform, FileAudio, Loader2, Plus, Trash2, Upload } from "lucide-react";
import type { DesktopVoice } from "../../../../shared/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toErrorMessage } from "@/lib/errors";
import { EmptyState } from "../../workspace/components/FeaturePage";
import { StatusIndicator } from "../../workspace/components/WorkstationPrimitives";
import {
  genderLabel,
  groupVieNeuVoices,
  parseVoiceMetadata,
  regionLabel,
  REFERENCE_MIN_SECONDS_HINT,
} from "../model/vieneu-voices";
import { useCreateCustomVoice, useDeleteCustomVoice, useUploadVoiceReference } from "../queries/voice-media.mutations";
import { useVoiceReferenceAsset } from "../queries/voice-media.queries";

const UNSET_GENDER = "UNSET";

export function VieNeuVoicesScreen({ voices, loading, error }: Readonly<{
  voices: DesktopVoice[];
  loading: boolean;
  error: string | null;
}>) {
  const groups = useMemo(() => groupVieNeuVoices(voices), [voices]);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
      <main className="min-w-0 overflow-y-auto">
        <header className="border-b border-border bg-[var(--voice-header)] px-5 py-4">
          <span className="text-caption font-bold text-text-muted">Âm thanh</span>
          <h1 className="mt-1 text-[20px] font-semibold">Giọng VieNeu</h1>
          <p className="mt-1 text-caption text-text-secondary">
            Giọng có sẵn của VieNeu và giọng bạn tự tạo từ một đoạn thu mẫu. Giọng tự tạo được lưu cục bộ trên máy này và chọn được ở tab Lời kể cho mọi dự án.
          </p>
        </header>

        <div className="space-y-6 px-5 py-4">
          {loading && !voices.length ? <p role="status" className="text-body text-text-muted">Đang tải danh sách giọng…</p> : null}
          {error && !voices.length ? <p role="alert" className="rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-body text-destructive">Không tải được danh sách giọng: {error}</p> : null}
          {notice && <p role="status" className="rounded-md border border-border bg-surface-input px-3 py-2 text-caption text-text-secondary">{notice}</p>}

          <VoiceSection
            title="Giọng của bạn"
            count={groups.custom.length}
            empty={<EmptyState title="Chưa có giọng tự tạo" description="Tải một đoạn thu mẫu ở khung bên phải để tạo giọng đầu tiên." icon={AudioWaveform} />}
          >
            {groups.custom.map(voice => <CustomVoiceRow key={voice.id} voice={voice} onNotice={setNotice} />)}
          </VoiceSection>

          <VoiceSection
            title="Giọng có sẵn của VieNeu"
            count={groups.builtIn.length}
            empty={loading ? null : <EmptyState title="Chưa có giọng VieNeu" description="Backend chưa trả về giọng VieNeu nào trong thư viện." icon={AudioWaveform} />}
          >
            {groups.builtIn.map(voice => <BuiltInVoiceRow key={voice.id} voice={voice} />)}
          </VoiceSection>
        </div>
      </main>

      <CreateVoicePanel onNotice={setNotice} />
    </div>
  );
}

function VoiceSection({ title, count, empty, children }: Readonly<{
  title: string; count: number; empty: React.ReactNode; children: React.ReactNode;
}>) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 flex items-baseline gap-2 text-body font-semibold text-foreground">
        {title}<span className="text-caption font-normal text-text-muted">{count} giọng</span>
      </h2>
      {count ? <ul className="grid grid-cols-1 gap-2 2xl:grid-cols-2">{children}</ul> : empty}
    </section>
  );
}

function VoiceMeta({ voice }: Readonly<{ voice: DesktopVoice }>) {
  const metadata = parseVoiceMetadata(voice);
  const parts = [genderLabel(voice.gender), regionLabel(metadata.region), voice.language].filter(Boolean);
  return <span className="mt-0.5 block truncate text-caption text-text-muted">{parts.join(" · ")}</span>;
}

function BuiltInVoiceRow({ voice }: Readonly<{ voice: DesktopVoice }>) {
  const metadata = parseVoiceMetadata(voice);
  return (
    <li className="flex min-h-[64px] items-center gap-3 rounded-md border border-border-subtle bg-surface-panel px-3 py-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-dark text-text-secondary"><AudioWaveform size={16} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium text-foreground">{voice.name}</span>
        <VoiceMeta voice={voice} />
      </span>
      {metadata.featured && <StatusIndicator label="Nổi bật" tone="accent" className="shrink-0" />}
    </li>
  );
}

function CustomVoiceRow({ voice, onNotice }: Readonly<{ voice: DesktopVoice; onNotice(value: string | null): void }>) {
  const remove = useDeleteCustomVoice();
  const [confirming, setConfirming] = useState(false);
  const metadata = parseVoiceMetadata(voice);

  async function confirmRemove() {
    onNotice(null);
    try {
      await remove.mutateAsync(voice.id);
      onNotice(`Đã xóa giọng “${voice.name}”. Các lời kể đã tạo vẫn giữ nguyên.`);
    } catch (cause) {
      setConfirming(false);
      onNotice(toErrorMessage(cause, "Không xóa được giọng. Hãy thử lại."));
    }
  }

  return (
    <li className="flex min-h-[72px] items-center gap-3 rounded-md border border-primary/30 bg-primary-muted/30 px-3 py-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-dark text-primary"><FileAudio size={16} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium text-foreground">{voice.name}</span>
        <VoiceMeta voice={voice} />
        {metadata.description && <span className="mt-0.5 block truncate text-caption text-text-secondary">{metadata.description}</span>}
        {metadata.referenceFilename && <span className="mt-0.5 block truncate text-caption text-text-dim">Giọng mẫu: {metadata.referenceFilename}</span>}
      </span>
      {confirming ? (
        <span className="flex shrink-0 items-center gap-1.5">
          <Button type="button" variant="destructive" size="sm" disabled={remove.isPending} onClick={() => void confirmRemove()}>
            {remove.isPending && <Loader2 size={13} className="animate-spin" />}Xác nhận xóa
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={remove.isPending} onClick={() => setConfirming(false)}>Hủy</Button>
        </span>
      ) : (
        <Button type="button" variant="ghost" size="icon" aria-label={`Xóa giọng ${voice.name}`} onClick={() => setConfirming(true)} className="shrink-0">
          <Trash2 size={15} />
        </Button>
      )}
    </li>
  );
}

function CreateVoicePanel({ onNotice }: Readonly<{ onNotice(value: string | null): void }>) {
  const create = useCreateCustomVoice();
  const upload = useUploadVoiceReference();
  const [name, setName] = useState("");
  const [gender, setGender] = useState(UNSET_GENDER);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState<{ assetId: string; filename: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const referenceQuery = useVoiceReferenceAsset(reference?.assetId ?? null);

  const referenceStatus = referenceQuery.data?.status ?? null;
  const referenceReady = referenceStatus === "READY";
  const referenceRejected = referenceStatus === "REJECTED" || referenceQuery.isError;
  const canSubmit = Boolean(name.trim() && reference && referenceReady) && !create.isPending;

  async function pickReference() {
    if (upload.isPending) return;
    setUploadError(null);
    try {
      const uploaded = await upload.mutateAsync();
      if (uploaded) setReference({ assetId: uploaded.assetId, filename: uploaded.originalFilename });
    } catch (cause) {
      setUploadError(toErrorMessage(cause, "Không tải được file giọng mẫu."));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || !reference) return;
    onNotice(null);
    try {
      const created = await create.mutateAsync({
        name: name.trim(),
        referenceAssetId: reference.assetId,
        ...(gender !== UNSET_GENDER ? { gender: gender as "MALE" | "FEMALE" | "NEUTRAL" } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      setName(""); setGender(UNSET_GENDER); setDescription(""); setReference(null);
      onNotice(`Đã tạo giọng “${created.name}”. Chọn giọng này ở tab Lời kể để đọc chương.`);
    } catch { /* The mutation error is rendered below; keep the draft. */ }
  }

  return (
    <aside className="min-h-0 overflow-y-auto border-l border-border bg-surface-dark p-4">
      <form onSubmit={event => void submit(event)} className="space-y-4" aria-label="Tạo giọng mới">
        <div>
          <h2 className="text-body font-semibold text-foreground">Tạo giọng mới</h2>
          <p className="mt-1 text-caption leading-relaxed text-text-muted">
            VieNeu sao chép giọng từ đoạn thu mẫu ({REFERENCE_MIN_SECONDS_HINT}). Chỉ dùng giọng của chính bạn hoặc giọng bạn có quyền sử dụng.
          </p>
        </div>

        <fieldset disabled={create.isPending} className="space-y-4 disabled:opacity-60">
          <label className="grid gap-2 text-body text-text-secondary">Tên giọng
            <Input required maxLength={64} value={name} onChange={event => setName(event.target.value)} placeholder="Ví dụ: Giọng bà kể chuyện" />
          </label>

          <div className="grid gap-2 text-body text-text-secondary">
            <span id="custom-voice-reference-label">File giọng mẫu</span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" aria-describedby="custom-voice-reference-status" onClick={() => void pickReference()} disabled={upload.isPending}>
                {upload.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {reference ? "Chọn file khác" : "Chọn file MP3/WAV"}
              </Button>
              {reference && <span className="min-w-0 truncate text-caption text-text-secondary" title={reference.filename}>{reference.filename}</span>}
            </div>
            <p id="custom-voice-reference-status" role="status" className={`text-caption ${referenceRejected ? "text-destructive" : referenceReady ? "text-success" : "text-text-muted"}`}>
              {uploadError ?? (!reference ? "Chưa chọn file." : referenceRejected ? "File bị từ chối. Hãy chọn đoạn MP3/WAV sạch dài ít nhất 3 giây." : referenceReady ? "File hợp lệ, sẵn sàng tạo giọng." : "Đang kiểm tra file…")}
            </p>
          </div>

          <label className="grid gap-2 text-body text-text-secondary">Giới tính
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger aria-label="Giới tính"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET_GENDER}>Không chỉ định</SelectItem>
                <SelectItem value="MALE">Nam</SelectItem>
                <SelectItem value="FEMALE">Nữ</SelectItem>
                <SelectItem value="NEUTRAL">Trung tính</SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label className="grid gap-2 text-body text-text-secondary">Mô tả <span className="sr-only">(không bắt buộc)</span>
            <Textarea maxLength={500} rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="Ví dụ: trầm, ấm, nhịp chậm." />
          </label>
        </fieldset>

        {create.isError && <p role="alert" className="text-body text-destructive">{toErrorMessage(create.error, "Không tạo được giọng. Hãy thử lại.")}</p>}

        <Button type="submit" disabled={!canSubmit} className="w-full">
          {create.isPending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}Tạo giọng
        </Button>
      </form>
    </aside>
  );
}
