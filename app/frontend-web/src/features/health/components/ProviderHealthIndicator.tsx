"use client";

import { useState } from "react";
import { Cpu, Sparkles } from "lucide-react";
import { useProviderHealth } from "../hooks/useProviderHealth";

export function ProviderHealthIndicator() {
  const { data: health, isLoading, isError } = useProviderHealth();
  const [showTooltip, setShowTooltip] = useState(false);

  const isHealthy = !isError && health?.vertexGemini.status === "HEALTHY";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowTooltip((prev) => !prev)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-panel/80 px-2.5 py-1 text-[11px] text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
        aria-label="Trạng thái hệ thống AI"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isLoading
              ? "bg-warning animate-pulse"
              : isHealthy
                ? "bg-success"
                : "bg-danger"
          }`}
        />
        <Cpu className="h-3.5 w-3.5 text-text-muted" />
        <span className="font-mono text-[10px]">
          {isLoading ? "AI: Checking" : isHealthy ? "AI: Online" : "AI: Offline"}
        </span>
      </button>

      {/* Tooltip / Status Popover */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-border bg-surface-card p-3 shadow-xl z-30 text-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="font-semibold text-text-primary flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Trạng thái Provider
            </span>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                isHealthy ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
              }`}
            >
              {health?.vertexGemini.status ?? (isLoading ? "CHECKING" : "OFFLINE")}
            </span>
          </div>

          <div className="mt-2.5 space-y-1.5 text-[11px] text-text-secondary">
            <div className="flex justify-between">
              <span className="text-text-muted">Model:</span>
              <span className="font-mono text-text-primary">{health?.vertexGemini.model ?? "gemini-1.5-flash"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Region:</span>
              <span className="font-mono text-text-primary">{health?.vertexGemini.location ?? "us-central1"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Đã xác thực call:</span>
              <span className="text-success font-medium">
                {health?.vertexGemini.externalCallVerified ? "Có (Verified)" : "Đang kiểm tra"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
