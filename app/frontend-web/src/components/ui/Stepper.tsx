import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface StepItem {
  id: number;
  label: string;
}

interface StepperProps {
  steps?: StepItem[];
  currentStep: number;
  maxAccessibleStep?: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

const DEFAULT_STEPS: StepItem[] = [
  { id: 1, label: "Thông tin cơ bản" },
  { id: 2, label: "Nhập truyện" },
  { id: 3, label: "Phân tích AI" },
  { id: 4, label: "Xác nhận" },
];

export const Stepper: React.FC<StepperProps> = ({
  steps = DEFAULT_STEPS,
  currentStep,
  maxAccessibleStep = currentStep,
  onStepClick,
  className,
}) => {
  return (
    <div className={cn("flex flex-col gap-4 w-48 shrink-0 pr-4", className)}>
      {steps.map((step) => {
        const isCompleted = step.id < currentStep;
        const isActive = step.id === currentStep;
        const isClickable = step.id <= maxAccessibleStep;

        const handleClick = () => {
          if (isClickable && onStepClick) {
            onStepClick(step.id);
          }
        };

          return (
          <button
            type="button"
            key={step.id}
            onClick={handleClick}
            disabled={!isClickable}
            aria-current={isActive ? "step" : undefined}
            className={cn(
              "flex w-full items-center gap-3 py-1 text-left text-sm font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-40",
              isActive && "text-primary-hover font-semibold opacity-100",
              isCompleted && "text-slate-300 hover:text-white opacity-100",
              !isActive && !isCompleted && isClickable && "text-slate-400 hover:text-slate-200",
              !isActive && !isCompleted && !isClickable && "text-slate-600"
            )}
          >
            <span
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors duration-200 shrink-0",
                isActive &&
                  "bg-primary text-white ring-4 ring-primary/20 font-bold",
                isCompleted && "bg-primary-muted text-primary-hover border border-primary/60 font-semibold",
                !isActive &&
                  !isCompleted &&
                  isClickable &&
                  "bg-slate-800/80 text-slate-400 border border-slate-700",
                !isActive &&
                  !isCompleted &&
                  !isClickable &&
                  "bg-surface-panel text-text-muted border border-border"
              )}
            >
              {isCompleted ? (
                <Check className="w-3.5 h-3.5 text-primary-hover stroke-[2.5]" aria-hidden="true" />
              ) : (
                step.id
              )}
            </span>
            <span className="truncate">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
};
