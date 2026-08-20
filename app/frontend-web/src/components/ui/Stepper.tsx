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
          <div
            key={step.id}
            onClick={handleClick}
            className={cn(
              "flex items-center gap-3 text-sm font-medium transition-colors py-1 select-none",
              isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-40",
              isActive && "text-purple-400 font-semibold opacity-100",
              isCompleted && "text-slate-300 hover:text-white opacity-100",
              !isActive && !isCompleted && isClickable && "text-slate-400 hover:text-slate-200",
              !isActive && !isCompleted && !isClickable && "text-slate-600"
            )}
          >
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors duration-200 shrink-0",
                isActive &&
                  "bg-purple-600 text-white ring-4 ring-purple-600/20 shadow-[0_0_12px_rgba(124,58,237,0.5)] font-bold",
                isCompleted && "bg-purple-900/60 text-purple-300 border border-purple-700/60 font-semibold",
                !isActive &&
                  !isCompleted &&
                  isClickable &&
                  "bg-slate-800/80 text-slate-400 border border-slate-700",
                !isActive &&
                  !isCompleted &&
                  !isClickable &&
                  "bg-[#090e18] text-slate-600 border border-slate-800/80"
              )}
            >
              {isCompleted ? (
                <Check className="w-3.5 h-3.5 text-purple-300 stroke-[2.5]" />
              ) : (
                step.id
              )}
            </div>
            <span className="truncate">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
};
