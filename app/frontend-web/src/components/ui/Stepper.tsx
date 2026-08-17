import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepItem {
  id: number;
  label: string;
}

interface StepperProps {
  steps?: StepItem[];
  currentStep: number;
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
  onStepClick,
  className,
}) => {
  return (
    <div className={cn("flex flex-col gap-4 w-48 shrink-0 pr-4", className)}>
      {steps.map((step) => {
        const isCompleted = step.id < currentStep;
        const isActive = step.id === currentStep;

        return (
          <div
            key={step.id}
            onClick={() => onStepClick && onStepClick(step.id)}
            className={cn(
              "flex items-center gap-3 text-sm font-medium transition-colors py-1 cursor-pointer select-none",
              isActive && "text-purple-400 font-semibold",
              isCompleted && "text-slate-300",
              !isActive && !isCompleted && "text-slate-500 hover:text-slate-400"
            )}
          >
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all duration-200 shrink-0",
                isActive &&
                  "bg-purple-600 text-white ring-4 ring-purple-600/20 shadow-[0_0_12px_rgba(124,58,237,0.5)]",
                isCompleted && "bg-purple-900/60 text-purple-300 border border-purple-700/60",
                !isActive &&
                  !isCompleted &&
                  "bg-slate-800/80 text-slate-400 border border-slate-700"
              )}
            >
              {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.id}
            </div>
            <span className="truncate">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
};
