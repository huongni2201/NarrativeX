"use client";

import {
  CreditCard,
  X,
  Zap,
  Film,
  Sparkles,
  Calendar,
  Layers,
} from "lucide-react";
import { useUserQuota } from "../hooks/useUserQuota";
import { Modal } from "@/components/ui/Modal";

interface QuotaDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuotaDetailModal({ isOpen, onClose }: Readonly<QuotaDetailModalProps>) {
  const { data: quota, isLoading } = useUserQuota();

  if (!isOpen) return null;

  const isUnlimited = quota?.totalCredits === null || quota?.tier === "ULTRA";
  const totalCredits =
    quota?.totalCredits !== null && quota?.totalCredits !== undefined
      ? Number(quota.totalCredits)
      : null;
  const remainingCredits =
    quota?.remainingCredits !== null && quota?.remainingCredits !== undefined
      ? Number(quota.remainingCredits)
      : null;
  const creditsUsed = Number(quota?.usage.creditsUsed ?? 0);
  const usedPercent =
    totalCredits !== null && totalCredits > 0
      ? Math.min(100, Math.round((creditsUsed / totalCredits) * 100))
      : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Chi tiết hạn mức tài khoản" maxWidth="lg">
      <div className="w-full bg-surface-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-muted text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-text-primary">Hạn mức & Gói tài khoản</h2>
                <span className="rounded-full border border-primary/40 bg-primary-muted px-2.5 py-0.5 font-mono text-[10px] font-bold text-primary-hover uppercase">
                  {quota?.tier ?? "STARTER"}
                  {isUnlimited && " (PAY-AS-YOU-GO)"}
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                {isUnlimited
                  ? "Tài khoản không giới hạn — Tính phí theo lượng sử dụng thực tế"
                  : "Chi tiết hạn mức credits, xuất file và năng lực xử lý"}
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

        <div className="p-5 space-y-5">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-xs text-text-muted">
              Đang tải thông tin hạn mức…
            </div>
          ) : (
            <>
              {/* Credits Usage Bar */}
              <div className="rounded-xl border border-border bg-surface-panel p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-warning" />
                    <span className="text-xs font-semibold text-text-secondary">NarrativeX Credits</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-text-primary">
                    {isUnlimited
                      ? "Không giới hạn (Pay-as-you-go)"
                      : `${(remainingCredits ?? 0).toLocaleString()} / ${(totalCredits ?? 0).toLocaleString()}`}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-3">
                  {isUnlimited ? (
                    <div className="h-full w-full bg-gradient-to-r from-primary via-orange-500 to-emerald-400" />
                  ) : (
                    <div
                      className="h-full bg-gradient-to-r from-primary to-orange-400 transition-[width] duration-500"
                      style={{ width: `${Math.max(5, 100 - usedPercent)}%` }}
                    />
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
                  {isUnlimited ? (
                    <>
                      <span>Đã sử dụng: {creditsUsed.toLocaleString()} credits (Dùng tới đâu tính tới đó)</span>
                      <span className="text-success font-medium">Không giới hạn</span>
                    </>
                  ) : (
                    <>
                      <span>Đã dùng: {creditsUsed.toLocaleString()} credits ({usedPercent}%)</span>
                      <span>Còn lại: {(remainingCredits ?? 0).toLocaleString()}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Limits and Capabilities */}
              <div>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2.5">
                  Quyền lợi gói ({quota?.tier ?? "FREE"})
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-border bg-surface-panel p-3">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      <span>Tác vụ đồng thời</span>
                    </div>
                    <p className="mt-1 text-base font-bold text-text-primary">
                      {quota?.limits.maxConcurrentExpensiveJobs ?? 1} job
                    </p>
                    <span className="text-[10px] text-text-muted">
                      Hiện tại đang chạy: {quota?.usage.expensiveJobsActive ?? 0}
                    </span>
                  </div>

                  <div className="rounded-xl border border-border bg-surface-panel p-3">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <Sparkles className="h-3.5 w-3.5 text-success" />
                      <span>Chất lượng video tối đa</span>
                    </div>
                    <p className="mt-1 text-base font-bold text-text-primary uppercase">
                      {quota?.limits.maxVideoQuality ?? "STANDARD"} (1080p)
                    </p>
                    <span className="text-[10px] text-text-muted">
                      Watermark: {quota?.limits.watermarkRequired ? "Có" : "Không"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-border bg-surface-panel p-3">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <Film className="h-3.5 w-3.5 text-primary" />
                      <span>Xuất video dài / tháng</span>
                    </div>
                    <p className="mt-1 text-base font-bold text-text-primary">
                      {quota?.usage.longformExports ?? 0} /{" "}
                      {quota?.limits.maxLongformExportsMonth ? `${quota.limits.maxLongformExportsMonth}` : "Không giới hạn"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-surface-panel p-3">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <Film className="h-3.5 w-3.5 text-primary" />
                      <span>Xuất Shorts / tháng</span>
                    </div>
                    <p className="mt-1 text-base font-bold text-text-primary">
                      {quota?.usage.shortExports ?? 0} /{" "}
                      {quota?.limits.maxShortExportsMonth ? `${quota.limits.maxShortExportsMonth}` : "Không giới hạn"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Period start & end */}
              {quota?.periodStart && quota?.periodEnd && (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/40 px-3.5 py-2.5 text-xs text-text-muted">
                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    Kỳ hạn mức: <strong className="text-text-secondary">{quota.periodStart}</strong> đến{" "}
                    <strong className="text-text-secondary">{quota.periodEnd}</strong>
                  </span>
                </div>
              )}
            </>
          )}

          <div className="pt-2 border-t border-border flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
