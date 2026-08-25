import { useEffect, useMemo, useState } from "react";
import type { DesktopAsset, DesktopChapterDetails, DesktopVoice } from "@narrativex/client-contracts";
import { AudioLines, Mic2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, FeaturePage } from "../../workspace/components/FeaturePage";
import {
  useGenerateBatchNarration,
  useGenerateNarration,
} from "../../generation/queries/narration.queries";

export function VoiceScreen({
  projectId,
  chapters,
  voices,
  assets,
}: Readonly<{
  projectId: string;
  chapters: DesktopChapterDetails[];
  voices: DesktopVoice[];
  assets: DesktopAsset[];
}>) {
  const generate = useGenerateNarration();
  const generateBatch = useGenerateBatchNarration();
  const [chapterId, setChapterId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [speakingRate, setSpeakingRate] = useState("1");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!chapterId && chapters[0]) setChapterId(chapters[0].id);
    if (!voiceId && voices[0]) setVoiceId(voices[0].id);
  }, [chapterId, chapters, voiceId, voices]);

  const selectedVoice = voices.find((voice) => voice.id === voiceId) ?? null;
  const audioAssets = useMemo(() => assets.filter((asset) => asset.type === "AUDIO"), [assets]);
  const rate = Number.parseFloat(speakingRate);

  async function runSingle() {
    if (!chapterId || !voiceId) return;
    setNotice(null);
    try {
      const job = await generate.mutateAsync({
        projectId,
        request: { chapterId, voiceId, speakingRate: Number.isFinite(rate) ? rate : 1 },
      });
      setNotice(`Narration job ${job.jobId.slice(0, 8)} đã được queue.`);
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  async function runBatch() {
    if (!voiceId || !chapters.length) return;
    setNotice(null);
    try {
      const jobs = await generateBatch.mutateAsync({
        projectId,
        chapterIds: chapters.map((chapter) => chapter.id),
        voiceId,
        speakingRate: Number.isFinite(rate) ? rate : 1,
      });
      setNotice(`${jobs.length} narration job đã được queue.`);
    } catch (error) {
      setNotice(toMessage(error));
    }
  }

  return (
    <FeaturePage
      title="Voice & TTS"
      description="Chọn voice, chapter và speaking rate để tạo narration đơn lẻ hoặc batch; audio asset hiện có được hiển thị riêng."
      actions={
        <Button size="sm" onClick={() => void runSingle()} disabled={!chapterId || !voiceId || generate.isPending}>
          <Mic2 size={14} /> {generate.isPending ? "Queuing…" : "Generate narration"}
        </Button>
      }
    >
      <div className="grid gap-4">
        <section className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 rounded-lg border border-border bg-card p-4">
          <Field label="Chapter">
            <Select value={chapterId || undefined} onValueChange={setChapterId}>
              <SelectTrigger><SelectValue placeholder="Chọn chapter" /></SelectTrigger>
              <SelectContent>
                {chapters.map((chapter) => <SelectItem key={chapter.id} value={chapter.id}>{chapter.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Voice">
            <Select value={voiceId || undefined} onValueChange={setVoiceId}>
              <SelectTrigger><SelectValue placeholder="Chọn voice" /></SelectTrigger>
              <SelectContent>
                {voices.map((voice) => <SelectItem key={voice.id} value={voice.id}>{voice.name} · {voice.language}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Speaking rate">
            <Input value={speakingRate} onChange={(event) => setSpeakingRate(event.target.value)} inputMode="decimal" />
          </Field>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={() => void runBatch()} disabled={!voiceId || !chapters.length || generateBatch.isPending}>
              <AudioLines size={14} /> Generate all chapters
            </Button>
          </div>
        </section>

        {notice && <p className="text-[10px] text-muted-foreground">{notice}</p>}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold">Voice catalog</h2>
            <span className="text-[10px] text-muted-foreground">{voices.length} voices</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {voices.map((voice) => (
              <button
                type="button"
                key={voice.id}
                onClick={() => setVoiceId(voice.id)}
                className={`grid gap-2 rounded-lg border p-3 text-left ${voice.id === voiceId ? "border-primary bg-primary-muted" : "border-border bg-card"}`}
              >
                <div className="flex items-center gap-2">
                  <Mic2 size={17} className="text-primary-hover" />
                  <strong className="truncate text-xs">{voice.name}</strong>
                </div>
                <span className="text-[10px] text-muted-foreground">{voice.provider} · {voice.language} · {voice.gender ?? "neutral"}</span>
                {voice.sampleUrl && <span className="inline-flex items-center gap-1 text-[9px] text-primary-hover"><Play size={11} /> Sample available</span>}
              </button>
            ))}
          </div>
          {!voices.length && <EmptyState title="Chưa có voice" description="Voice catalog từ backend đang trống." />}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold">Audio assets</h2>
            <span className="text-[10px] text-muted-foreground">{audioAssets.length} files</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
            {audioAssets.map((asset) => (
              <div key={asset.id} className="rounded-md border border-border bg-card p-3">
                <strong className="block truncate text-[10px]">{asset.originalFilename}</strong>
                <span className="text-[9px] text-muted-foreground">{asset.status} · {asset.durationMs ? `${Math.round(asset.durationMs / 1000)}s` : "duration unknown"}</span>
              </div>
            ))}
          </div>
        </section>

        {selectedVoice && <span className="text-[9px] text-muted-foreground">Selected voice ID: {selectedVoice.id}</span>}
      </div>
    </FeaturePage>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return <label className="grid gap-1 text-[10px] text-muted-foreground"><span>{label}</span>{children}</label>;
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "Narration request thất bại.";
}
