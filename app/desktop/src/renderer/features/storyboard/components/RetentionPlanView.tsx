import type { AttentionEvent, HookPlan, RetentionMap } from "@narrativex/client-contracts";
import { AlertTriangle, Clock, HelpCircle, Lightbulb, Sparkles, TrendingUp, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface RetentionPlanViewProps {
  hookPlan?: HookPlan | null;
  retentionMap?: RetentionMap | null;
}

export function RetentionPlanView({ hookPlan, retentionMap }: Readonly<RetentionPlanViewProps>) {
  const events = retentionMap?.attentionEvents ?? [];
  const pacingWarnings = events.filter((e: AttentionEvent) => e.eventType === "PACING_RISK");
  const storyEvents = events.filter((e: AttentionEvent) => e.eventType !== "PACING_RISK");

  return (
    <div className="flex flex-col gap-4 p-4 text-[12px]">
      {/* 1. Hook Plan Card */}
      <section className="border border-border-subtle bg-surface-panel p-4 rounded-md">
        <div className="flex items-center gap-2 text-primary font-semibold text-[13px] mb-3">
          <Sparkles size={16} />
          <span>Audience Hook Plan (First 3–5 Seconds)</span>
        </div>

        {hookPlan ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-text-secondary">
            <div className="border border-border-soft bg-surface-dark p-2.5 rounded">
              <div className="text-[10px] uppercase text-text-dim font-bold">Curiosity Question</div>
              <div className="mt-1 text-foreground font-medium">{hookPlan.curiosityQuestion}</div>
            </div>
            <div className="border border-border-soft bg-surface-dark p-2.5 rounded">
              <div className="text-[10px] uppercase text-text-dim font-bold">Narrative Promise</div>
              <div className="mt-1 text-foreground font-medium">{hookPlan.promise}</div>
            </div>
            <div className="border border-border-soft bg-surface-dark p-2.5 rounded">
              <div className="text-[10px] uppercase text-text-dim font-bold">Visual Hook</div>
              <div className="mt-1 text-foreground font-medium flex items-center gap-1.5">
                <Video size={13} className="text-cyan" /> {hookPlan.visualHook}
              </div>
            </div>
            <div className="border border-border-soft bg-surface-dark p-2.5 rounded">
              <div className="text-[10px] uppercase text-text-dim font-bold">Conflict & Stakes</div>
              <div className="mt-1 text-foreground font-medium">{hookPlan.conflict}</div>
            </div>
            <div className="border border-border-soft bg-surface-dark p-2.5 rounded md:col-span-2">
              <div className="text-[10px] uppercase text-text-dim font-bold">Withheld Information</div>
              <div className="mt-1 text-foreground font-medium">{hookPlan.withheldInformation}</div>
            </div>
          </div>
        ) : (
          <div className="text-text-muted italic">No Hook Plan generated yet. Run chapter analysis to construct.</div>
        )}
      </section>

      {/* 2. Pacing Guardrails Warnings */}
      {pacingWarnings.length > 0 && (
        <section className="border border-destructive/40 bg-destructive/10 p-3 rounded-md">
          <div className="flex items-center gap-2 text-destructive font-semibold mb-2">
            <AlertTriangle size={15} />
            <span>Pacing & Retention Risks Detected</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {pacingWarnings.map((warning: AttentionEvent, idx: number) => (
              <div key={idx} className="text-[11px] text-destructive-foreground">
                • {warning.description}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Attention Events & Curiosity Loops */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tension & Attention Events */}
        <div className="border border-border-subtle bg-surface-panel p-4 rounded-md">
          <div className="flex items-center gap-2 text-foreground font-semibold mb-3">
            <TrendingUp size={15} className="text-primary" />
            <span>Attention Reset Events ({storyEvents.length})</span>
          </div>
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
            {storyEvents.length > 0 ? (
              storyEvents.map((evt: AttentionEvent, idx: number) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-2 border-b border-border-soft pb-2 last:border-0"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{evt.description}</span>
                    <span className="text-[10px] text-text-dim flex items-center gap-1 mt-0.5">
                      <Clock size={10} /> {(evt.timeOffsetMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                    {evt.eventType}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-text-muted italic">No attention events recorded.</div>
            )}
          </div>
        </div>

        {/* Curiosity Questions */}
        <div className="border border-border-subtle bg-surface-panel p-4 rounded-md">
          <div className="flex items-center gap-2 text-foreground font-semibold mb-3">
            <HelpCircle size={15} className="text-cyan" />
            <span>Open Curiosity Loops</span>
          </div>
          <div className="flex flex-col gap-2">
            {hookPlan?.curiosityQuestion && (
              <div className="border border-border-soft bg-surface-dark p-2.5 rounded flex items-center gap-2">
                <Lightbulb size={14} className="text-primary shrink-0" />
                <span>{hookPlan.curiosityQuestion}</span>
              </div>
            )}
            <div className="text-[10px] text-text-muted mt-2">
              Audience retention is sustained by ensuring no more than 15s elapsed between curiosity triggers or narrative shifts.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
