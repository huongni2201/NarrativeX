"use client";

import { useState } from "react";
import { Volume2, X, Sparkles, Check, AlertCircle, Loader2 } from "lucide-react";
import { PRESET_VOICES } from "../types/narration.types";
import { useGenerateNarration } from "../hooks/useGenerateNarration";
import { apiErrorMessage } from "@/shared/api/client";
import type { ApiGenerationJob } from "@/types/api";

interface GenerateNarrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  chapterId: number;
  chapterTitle: string;
  onJobStarted?: (job: ApiGenerationJob) => void;
}

export function GenerateNarrationModal({
  isOpen,
  onClose,
  projectId,
  chapterId,
  chapterTitle,
  onJobStarted,
}: Readonly<GenerateNarrationModalProps>) {
  const [selectedVoice, setSelectedVoice] = useState<string>("vi-VN-Standard-A");
  const [speakingRate, setSpeakingRate] = useState<number>(1.0);
  const [languageFilter, setLanguageFilter] = useState<string>("vi-VN");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const generateMutation = useGenerateNarration();

  if (!isOpen) return null;

  const filteredVoices = PRESET_VOICES.filter((v) => v.language === languageFilter);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      const job = await generateMutation.mutateAsync({
        projectId,
        chapterId,
        input: {
          voiceId: selectedVoice,
          speakingRate,
        },
      });
      onJobStarted?.(job);
      onClose();
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, "Không thể bắt đầu tạo giọng đọc. Vui lòng thử lại."));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
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
                  setSelectedVoice("vi-VN-Standard-A");
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
                  setSelectedVoice("en-US-Standard-C");
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
                    onClick={() => setSelectedVoice(voice.id)}
                    className={`flex flex-col text-left rounded-xl border p-3 transition-all ${
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

          {/* Speaking rate */}
          <div className="rounded-xl border border-border bg-surface-panel p-3.5">
            <div className="flex items-center justify-between">
              <label htmlFor="speaking-rate-slider" className="text-xs font-semibold text-text-secondary">
                Tốc độ đọc
              </label>
              <span className="font-mono text-xs font-bold text-primary-hover">
                {speakingRate.toFixed(2)}x
              </span>
            </div>

            <input
              id="speaking-rate-slider"
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={speakingRate}
              onChange={(e) => setSpeakingRate(Number.parseFloat(e.target.value))}
              className="mt-3 w-full accent-purple-500"
            />

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
                disabled={generateMutation.isPending || !selectedVoice}
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
      </div>
    </div>
  );
}
