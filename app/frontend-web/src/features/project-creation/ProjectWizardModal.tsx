import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStudioStore } from "@/store/useStudioStore";
import { useProductionStore } from "@/store/useProductionStore";
import { Modal } from "@/components/ui/Modal";
import { Stepper } from "@/components/ui/Stepper";
import { Step1BasicInfo } from "./Step1BasicInfo";
import { Step2ImportStory } from "./Step2ImportStory";
import { Step3AiAnalysis } from "./Step3AiAnalysis";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { api, apiErrorMessage, ApiClientError } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ProjectWizardDraft } from "@/types/studio";
import type { ApiFieldError } from "@/types/api";

const Step4Results = dynamic(() =>
  import("./Step4Results").then((module) => module.Step4Results),
);

const languageCodes: Record<string, string> = {
  "Tiếng Việt": "vi-VN",
  English: "en",
  "日本語": "ja",
  "한국어": "ko",
};

type WorkflowState = {
  fingerprint: string;
  project: Awaited<ReturnType<typeof api.createProject>>;
  storyCreated: boolean;
  storyStateUncertain: boolean;
};

export const ProjectWizardModal: React.FC = () => {
  const router = useRouter();
  const isWizardOpen = useStudioStore((state) => state.isWizardOpen);
  const closeWizard = useStudioStore((state) => state.closeWizard);
  const wizardDraft = useStudioStore((state) => state.wizardDraft);
  const setWizardStep = useStudioStore((state) => state.setWizardStep);
  const setView = useProductionStore((state) => state.setView);
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ApiFieldError[]>([]);
  const workflowRef = useRef<WorkflowState | null>(null);

  const resetLocalWorkflow = () => {
    workflowRef.current = null;
    setSubmitError(null);
    setValidationErrors([]);
  };

  const createProjectWorkflow = useMutation({
    mutationFn: async (draft: ProjectWizardDraft) => {
      const language = languageCodes[draft.language] ?? "vi-VN";
      const fingerprint = JSON.stringify({
        title: draft.title.trim(),
        storyText: draft.storyText.trim(),
        language,
        aspectRatio: draft.aspectRatio,
        quality: draft.quality,
      });
      const existingWorkflow = workflowRef.current?.fingerprint === fingerprint ? workflowRef.current : null;

      if (existingWorkflow?.storyStateUncertain) {
        throw new Error(
          "Không thể retry an toàn vì trạng thái request StoryVersion trước đó chưa xác định. Hãy mở project đã tạo và kiểm tra trước khi gửi lại nội dung.",
        );
      }

      const project = existingWorkflow?.project ?? await api.createProject({
        name: draft.title.trim(),
        sourceLanguage: language,
        narrationLanguage: language,
        metadataLanguage: language,
        imageAspectRatio: draft.aspectRatio,
        imageQualityTier: draft.quality.toUpperCase(),
      });

      workflowRef.current = existingWorkflow ?? {
        fingerprint,
        project,
        storyCreated: false,
        storyStateUncertain: false,
      };

      if (!workflowRef.current.storyCreated) {
        try {
          await api.createStoryVersion(project.id, {
            content: draft.storyText.trim(),
            sourceLanguage: language,
          });
          workflowRef.current = { ...workflowRef.current, storyCreated: true };
        } catch (error) {
          if (!(error instanceof ApiClientError)) {
            workflowRef.current = { ...workflowRef.current, storyStateUncertain: true };
          }
          throw error;
        }
      }

      return { project };
    },
    onSuccess: async ({ project }) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      resetLocalWorkflow();
      setView("overview");
      closeWizard();
      router.push(`/projects/${project.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiClientError) {
        const errors = error.errors ?? [];
        setValidationErrors(errors);
        setSubmitError(error.message);
        if (errors.some((fieldError) => ["content", "storyText"].includes(fieldError.field))) {
          setWizardStep(2);
        } else if (errors.length > 0) {
          setWizardStep(1);
        }
        return;
      }

      setValidationErrors([]);
      if (workflowRef.current?.storyStateUncertain) {
        setSubmitError(
          `Project #${workflowRef.current.project.id} đã được tạo nhưng FE không thể xác định StoryVersion request có được backend commit hay không. Để tránh tạo bản story trùng, nút retry bị khóa cho workflow này. Hãy đóng wizard và kiểm tra project trước.`,
        );
        return;
      }
      setSubmitError(apiErrorMessage(error, "Không thể tạo project từ backend."));
    },
  });

  const currentStep = wizardDraft.step;
  const [maxAccessibleStep, setMaxAccessibleStep] = useState<number>(currentStep);

  useEffect(() => {
    if (isWizardOpen) setMaxAccessibleStep((previous) => Math.max(previous, wizardDraft.step));
    else setMaxAccessibleStep(1);
  }, [isWizardOpen, wizardDraft.step]);

  if (!isWizardOpen) return null;

  const handleCloseWizard = () => {
    if (createProjectWorkflow.isPending) return;
    resetLocalWorkflow();
    createProjectWorkflow.reset();
    closeWizard();
  };

  const handleNext = () => {
    if (currentStep < 4) {
      const nextStep = (currentStep + 1) as 1 | 2 | 3 | 4;
      setMaxAccessibleStep((previous) => Math.max(previous, nextStep));
      setWizardStep(nextStep);
    }
  };

  const handleBack = () => {
    if (createProjectWorkflow.isPending) return;
    if (currentStep > 1) setWizardStep((currentStep - 1) as 1 | 2 | 3 | 4);
  };

  const handleStepClick = (stepId: number) => {
    if (createProjectWorkflow.isPending) return;
    if (stepId <= maxAccessibleStep) setWizardStep(stepId as 1 | 2 | 3 | 4);
  };

  const handleConfirm = () => {
    if (!wizardDraft.title.trim()) {
      setValidationErrors([]);
      setSubmitError("Vui lòng nhập tên dự án.");
      setWizardStep(1);
      return;
    }
    if (!wizardDraft.storyText.trim()) {
      setValidationErrors([]);
      setSubmitError("Vui lòng nhập nội dung truyện trước khi tạo dự án.");
      setWizardStep(2);
      return;
    }
    if (workflowRef.current?.storyStateUncertain) return;
    setSubmitError(null);
    setValidationErrors([]);
    createProjectWorkflow.mutate(wizardDraft);
  };

  const isCloseLocked = createProjectWorkflow.isPending;
  const isRetryBlocked = Boolean(workflowRef.current?.storyStateUncertain);

  return (
    <Modal isOpen={isWizardOpen} onClose={handleCloseWizard} maxWidth="6xl" className="p-0 border border-slate-800 bg-[#0d1420]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#090e18]">
        <div className="flex items-center gap-6">
          <span className="font-bold text-base text-white tracking-wide">
            {currentStep === 1 && "03. Tạo dự án mới"}
            {currentStep === 2 && "04. Nhập truyện"}
            {currentStep === 3 && "05. Phân tích AI – Tổng quan"}
            {currentStep === 4 && "06. Xác nhận"}
          </span>
        </div>
        <button type="button" onClick={handleCloseWizard} disabled={isCloseLocked} className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 p-1.5 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40" aria-label={isCloseLocked ? "Đang tạo dự án, chưa thể đóng" : "Đóng trình tạo dự án"}>
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 min-h-[500px]">
        <div className="border-b md:border-b-0 md:border-r border-slate-800/80 pb-4 md:pb-0">
          <Stepper currentStep={currentStep} maxAccessibleStep={maxAccessibleStep} onStepClick={handleStepClick} />
        </div>
        <div className="flex-1">
          {currentStep === 1 && <Step1BasicInfo onNext={handleNext} onCancel={handleCloseWizard} validationErrors={validationErrors} />}
          {currentStep === 2 && <Step2ImportStory onNext={handleNext} onBack={handleBack} validationErrors={validationErrors} />}
          {currentStep === 3 && <Step3AiAnalysis onNext={handleNext} onBack={handleBack} />}
          {currentStep === 4 && <Step4Results onBack={handleBack} />}
        </div>
      </div>

      <div className="px-8 py-4 bg-[#090e18] border-t border-slate-800/80 flex items-center justify-between">
        <div>
          {currentStep === 1 ? <Button variant="secondary" onClick={handleCloseWizard} disabled={isCloseLocked} size="md">Hủy</Button> : (
            <Button variant="secondary" onClick={handleBack} disabled={isCloseLocked} size="md"><ArrowLeft className="w-4 h-4 mr-1.5" />Quay lại</Button>
          )}
        </div>
        <div>
          {currentStep < 4 ? (
            <Button variant="primary" onClick={handleNext} disabled={isCloseLocked} size="md"><span>Tiếp tục</span><ArrowRight className="w-4 h-4 ml-1.5" /></Button>
          ) : (
            <Button variant="gradient" onClick={handleConfirm} disabled={createProjectWorkflow.isPending || isRetryBlocked} size="md" className="shadow-[0_0_20px_rgba(124,58,237,0.5)]">
              <Check className="w-4 h-4 mr-1.5" />
              <span>{createProjectWorkflow.isPending ? "Đang gửi lên backend…" : isRetryBlocked ? "Kiểm tra project trước khi retry" : "Xác nhận & Tạo dự án"}</span>
            </Button>
          )}
        </div>
      </div>

      {(submitError || validationErrors.length > 0) && (
        <div className="border-t border-rose-500/20 bg-rose-950/20 px-8 py-3 text-xs text-rose-200" role="alert">
          {submitError && <p>{submitError}</p>}
          {validationErrors.length > 0 && (
            <ul className="mt-2 space-y-1 text-rose-200/80">
              {validationErrors.map((fieldError, index) => (
                <li key={`${fieldError.field}-${index}`}><span className="font-medium">{fieldError.field}:</span>{" "}{fieldError.message || fieldError.code || "Giá trị không hợp lệ."}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
};
