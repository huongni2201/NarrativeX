"use client";

import { useEffect, useState } from "react";
import { Volume2, X, Sparkles, Check, AlertCircle, Loader2, FileAudio } from "lucide-react";
import { PRESET_VOICES, type VoiceOption } from "../types/narration.types";
import { useGenerateNarration } from "../hooks/useGenerateNarration";
import { apiErrorMessage } from "@/shared/api/client";
import type { ApiGenerationJob } from "@/types/api";
import { voicesApi } from "../api/voices.api";
import { isMockDataMode } from "@/lib/data-mode";
import { Modal } from "@/components/ui/Modal";

interface GenerateNarrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  chapterId: number;
  chapterTitle: string;
  onJobStarted?: (job: ApiGenerationJob) => void;
}

const GLOBAL_VIENEU_VOICE_ID = "vieneu-ngoc-huyen-v2";

export function GenerateNarrationModal({
  isOpen,
  onClose,
  projectId,
  chapterId,
  chapterTitle,
  onJobStarted,
}: Readonly<GenerateNarrationModalProps>) {
  const [selectedVoice, setSelectedVoice] = useState<string>(GLOBAL_VIENEU_VOICE_ID);
  const [speakingRate, setSpeakingRate] = useState<number>(1.0);
  const [languageFilter, setLanguageFilter] = useState<string>("vi-VN");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voices, setVoices] = useState<VoiceOption[]>(isMockDataMode ? PRESET_VOICES : []);

  useEffect(() => {
    if (isMockDataMode || !isOpen) return;
    voicesApi
      .list(languageFilter)
      .then((items) => {
        const mapped: VoiceOption[] = items.map((voice) => ({
          id: voice.id,
          name: voice.name,
          language: voice.language,
          gender: voice.gender === "MALE" ? "MALE" : "FEMALE",
          style: "Standard" as const,
          description: `${voice.provider} · ${voice.language}`,
          provider: voice.provider,
        }));
        setVoices(mapped);
        setSelectedVoice(
          mapped.find((voice) => voice.id === GLOBAL_VIENEU_VOICE_ID)?.id ?? mapped[0]?.id ?? "",
        );
      })
      .catch((error) => setErrorMessage(apiErrorMessage(error, "Không thể tải voice catalog.")));
  }, [isOpen, languageFilter]);

  const generateMutation = useGenerateNarration();

  if (!isOpen) return null;

  const filteredVoices = voices.filter((v) => v.language === languageFilter);
  const selectedVoiceOption = voices.find((voice) => voice.id === selectedVoice);
  const usesVieNeu = (voiceId: string, voice?: VoiceOption) =>
    voiceId.startsWith("vieneu-") || voice?.provider?.toUpperCase() === "VIENEU";
  const isPresetVieNeuVoice = usesVieNeu(selectedVoice, selectedVoiceOption);
  const effectiveSpeakingRate = isPresetVieNeuVoice ? 1.0 : speakingRate;

  const selectVoice = (voiceId: string) => {
    setSelectedVoice(voiceId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      const job = await generateMutation.mutateAsync({
        projectId,
        chapterId,
        input: {
          voiceId: selectedVoice,
          speakingRate: effectiveSpeakingRate,
          voiceReferenceAssetId: null,
        },
      });
      onJobStarted?.(job);
      onClose();
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, "Không thể bắt đầu tạo giọng đọc. Vui lòng thử lại."));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={`Tạo giọng đọc cho Chapter ${chapterTitle}`}
      closeDisabled={generateMutation.isPending}
      maxWidth="2xl"
      className="border-border bg-surface-card"
    >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-muted text-primary">
              <Volume2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Tạo giọng đọc (Narration)</h2>
              <p className="text-xs text-text-secondary truncate max-w-md">
                Chapter: <span className="text-text-primary font-medium">{chapterTitle}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={generateMutation.isPending}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Đóng modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {errorMessage && (
            <div className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger-bg p-3.5 text-xs text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Language filter */}
          <div>
            <label className="text-xs font-semibold text-text-secondary">Ngôn ngữ giọng đọc</label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setLanguageFilter("vi-VN");
                  selectVoice(isMockDataMode ? "vi-VN-Standard-A" : GLOBAL_VIENEU_VOICE_ID);
                }}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  languageFilter === "vi-VN"
                    ? "bg-primary text-white"
                    : "border border-border bg-surface-panel text-text-secondary hover:text-text-primary"
                }`}
              >
                Tiếng Việt (vi-VN)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLanguageFilter("en-US");
                  selectVoice(isMockDataMode ? "en-US-Standard-C" : "narrativex-en-us-female-1");
                }}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  languageFilter === "en-US"
                    ? "bg-primary text-white"
                    : "border border-border bg-surface-panel text-text-secondary hover:text-text-primary"
                }`}
              >
                English (en-US)
              </button>
            </div>
          </div>

          {/* Voice list */}
          <div>
            <label className="text-xs font-semibold text-text-secondary">Chọn giọng đọc AI</label>
            <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 max-h-56 overflow-y-auto pr-1">
              {filteredVoices.map((voice) => {
                const isSelected = selectedVoice === voice.id;
                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => selectVoice(voice.id)}
                    className={`flex flex-col rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary-muted/20 ring-2 ring-primary/40"
                        : "border-border bg-surface-panel hover:border-border-glow hover:bg-surface-2/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-primary">{voice.name}</span>
                      {isSelected ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-text-muted">
                          {voice.style}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-text-secondary leading-snug">
                      {voice.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* VieNeu voice source */}
          {isPresetVieNeuVoice && (
            <div className="rounded-xl border border-primary/30 bg-primary-muted/10 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-primary-muted p-2 text-primary">
                  <FileAudio className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-text-primary">Voice VieNeu dùng chung</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                    Ngọc Huyền v2 được đăng ký từ voice profile của hệ thống và dùng chung cho các chapter. Bạn không cần upload file âm thanh.
                  </p>
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-success">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Sẵn sàng dùng voice global · không cần upload
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Speaking rate */}
          <div className="rounded-xl border border-border bg-surface-panel p-3.5">
            <div className="flex items-center justify-between">
              <label htmlFor="speaking-rate-slider" className="text-xs font-semibold text-text-secondary">
                Tốc độ đọc
              </label>
              <span className="font-mono text-xs font-bold text-primary-hover">
                {effectiveSpeakingRate.toFixed(2)}x
              </span>
            </div>

            <input
              id="speaking-rate-slider"
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={effectiveSpeakingRate}
              disabled={isPresetVieNeuVoice}
              onChange={(e) => setSpeakingRate(Number.parseFloat(e.target.value))}
              className="mt-3 w-full accent-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
            />

            {isPresetVieNeuVoice ? (
              <p className="mt-2 text-[11px] text-text-muted">VieNeu hiện tổng hợp ở tốc độ chuẩn 1.0x.</p>
            ) : (
            <div className="mt-2 flex gap-1.5 justify-end">
              {[0.75, 1.0, 1.25, 1.5].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSpeakingRate(preset)}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    Math.abs(speakingRate - preset) < 0.01
                      ? "bg-primary text-white"
                      : "bg-surface-3 text-text-muted hover:text-text-primary"
                  }`}
                >
                  {preset}x
                </button>
              ))}
            </div>
            )}
          </div>

          {/* Footer Note and Actions */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between border-t border-border">
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Được lưu trữ tự động trên Cloudflare R2</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={generateMutation.isPending}
                className="rounded-lg border border-border bg-surface-panel px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
              >
                Hủy
              </button>

              <button
                type="submit"
                disabled={
                  generateMutation.isPending ||
                  !selectedVoice
                }
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Đang gửi yêu cầu…
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5" />
                    Bắt đầu tạo Audio
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
    </Modal>
  );
}
