import type {
  ChapterContentVariant,
  ChapterLanguageStatus,
  GenerationJobStatus,
} from "@narrativex/client-contracts";
import { Languages, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ChapterTranslationState = Readonly<{
  status: ChapterLanguageStatus | undefined;
  variants: ChapterContentVariant[] | undefined;
  loading: boolean;
  error: boolean;
  busy: boolean;
  jobStatus: GenerationJobStatus | null;
  blockedByUnsavedChanges: boolean;
  onTranslate: () => void;
  onRefresh: () => void;
}>;

export function ChapterTranslationCard({
  translation,
}: Readonly<{ translation: ChapterTranslationState }>) {
  const status = translation.status;
  const translatedVariant = findTranslatedVariant(status, translation.variants);
  const needsTranslation =
    status && status.translationStatus !== "NOT_REQUIRED" && status.translationStatus !== "COMPLETED";
  const canTranslate =
    Boolean(needsTranslation) &&
    !translation.loading &&
    !translation.error &&
    !translation.busy &&
    !translation.blockedByUnsavedChanges;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Languages className="mt-0.5 shrink-0 text-text-secondary" size={16} />
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-foreground">Ngôn ngữ & bản dịch</h3>
            <p className="mt-1 text-[10px] leading-4 text-text-secondary">
              Giữ nguyên nội dung gốc và tạo content variant theo ngôn ngữ của project.
            </p>
          </div>
        </div>
        <StatusBadge translation={translation} />
      </div>

      {translation.loading && (
        <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-[10px] text-text-secondary">
          <Loader2 className="animate-spin" size={13} /> Đang kiểm tra ngôn ngữ…
        </div>
      )}

      {translation.error && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-warning/20 bg-warning-bg px-3 py-2 text-[10px] text-warning">
          <span>Không tải được trạng thái ngôn ngữ của chapter.</span>
          <Button type="button" size="sm" variant="outline" onClick={translation.onRefresh}>
            <RefreshCw size={12} /> Thử lại
          </Button>
        </div>
      )}

      {status && !translation.loading && !translation.error && (
        <>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <Metric label="Phát hiện" value={languageLabel(status.detectedLanguage)} />
            <Metric
              label="Độ tin cậy"
              value={status.confidence == null ? "—" : `${Math.round(status.confidence * 100)}%`}
            />
            <Metric label="Ngôn ngữ project" value={languageLabel(status.projectLanguage)} />
          </div>

          <TranslationGuidance status={status} />

          {translatedVariant && (
            <div className="space-y-2 rounded-md border border-success/20 bg-success-bg p-3">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-[10px] text-success">
                  Bản dịch · {languageLabel(translatedVariant.languageCode)}
                </strong>
                <span className="text-[9px] text-text-muted">
                  {translatedVariant.translationProvider ?? "provider"}
                  {translatedVariant.translationModel ? ` · ${translatedVariant.translationModel}` : ""}
                </span>
              </div>
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[10px] leading-4 text-text-secondary">
                {translatedVariant.content}
              </p>
              <p className="border-t border-success/15 pt-2 text-[9px] text-text-muted">
                Khi bản dịch này còn khớp source hash hiện tại, thao tác Analyze sẽ dùng content variant này mặc định.
              </p>
            </div>
          )}

          {needsTranslation && (
            <Button
              type="button"
              onClick={translation.onTranslate}
              disabled={!canTranslate}
              className="h-8 w-full gap-1.5 text-xs font-bold"
            >
              {translation.busy ? <Loader2 className="animate-spin" size={13} /> : <Languages size={13} />}
              {translation.busy
                ? translation.jobStatus
                  ? `Đang dịch · ${translation.jobStatus}`
                  : "Đang gửi yêu cầu dịch…"
                : `Xác nhận & dịch sang ${languageLabel(status.projectLanguage)}`}
            </Button>
          )}

          {translation.blockedByUnsavedChanges && needsTranslation && (
            <p className="text-[10px] leading-4 text-warning">
              Hãy lưu thay đổi chapter trước khi tạo bản dịch để source hash không bị lệch.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ translation }: Readonly<{ translation: ChapterTranslationState }>) {
  let label = "Chưa kiểm tra";
  let className = "bg-surface-3 text-text-muted";
  if (translation.busy) {
    label = "Đang dịch";
    className = "bg-info-bg text-info";
  } else if (translation.status?.translationStatus === "COMPLETED") {
    label = "Đã dịch";
    className = "bg-success-bg text-success";
  } else if (translation.status?.translationStatus === "NOT_REQUIRED") {
    label = "Cùng ngôn ngữ";
    className = "bg-success-bg text-success";
  } else if (translation.status) {
    label = "Cần xác nhận";
    className = "bg-warning-bg text-warning";
  }
  return <span className={`shrink-0 rounded px-2 py-1 text-[9px] font-semibold ${className}`}>{label}</span>;
}

function TranslationGuidance({ status }: Readonly<{ status: ChapterLanguageStatus }>) {
  const message = (() => {
    switch (status.translationStatus) {
      case "NOT_REQUIRED":
        return "Ngôn ngữ chapter đã khớp với ngôn ngữ project; không cần tạo bản dịch.";
      case "COMPLETED":
        return "Bản dịch tương ứng với source hiện tại đã hoàn tất.";
      case "PENDING_CONFIRMATION":
        return `Hệ thống nhận diện ${languageLabel(status.detectedLanguage)} với độ tin cậy đủ cao. Xác nhận để dịch sang ${languageLabel(status.projectLanguage)}.`;
      case "MULTILINGUAL":
        return `Chapter chứa nhiều ngôn ngữ. Provider sẽ xử lý toàn bộ nội dung và dịch sang ${languageLabel(status.projectLanguage)}.`;
      case "LANGUAGE_SELECTION_REQUIRED":
        return `Ngôn ngữ nguồn chưa đủ chắc chắn. Bạn vẫn có thể xác nhận dịch nội dung sang ${languageLabel(status.projectLanguage)}.`;
    }
  })();

  return (
    <p className="rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-[10px] leading-4 text-text-secondary">
      {message}
    </p>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-2 px-2.5 py-2">
      <span className="block text-[9px] text-text-dim">{label}</span>
      <strong className="mt-0.5 block truncate text-[10px] text-foreground" title={value}>
        {value}
      </strong>
    </div>
  );
}

function findTranslatedVariant(
  status: ChapterLanguageStatus | undefined,
  variants: ChapterContentVariant[] | undefined,
): ChapterContentVariant | null {
  if (!status || !variants?.length) return null;
  if (status.existingTranslationVariantId) {
    return variants.find((variant) => variant.id === status.existingTranslationVariantId) ?? null;
  }
  return (
    variants.find(
      (variant) =>
        variant.variantType === "TRANSLATED" &&
        variant.translationStatus === "COMPLETED" &&
        sameLanguage(variant.languageCode, status.projectLanguage) &&
        variant.sourceContentHash === status.sourceContentHash,
    ) ?? null
  );
}

function sameLanguage(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return false;
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  return a === b || a.slice(0, 2) === b.slice(0, 2);
}

function languageLabel(value: string | null | undefined): string {
  if (!value || value === "UNKNOWN") return "Chưa xác định";
  if (value === "MULTILINGUAL") return "Đa ngôn ngữ";
  const normalized = value.toLowerCase().split("-")[0];
  const known: Record<string, string> = {
    vi: "Tiếng Việt",
    en: "English",
    ja: "日本語",
    ko: "한국어",
    zh: "中文",
    fr: "Français",
    de: "Deutsch",
    es: "Español",
  };
  return known[normalized] ?? value;
}
