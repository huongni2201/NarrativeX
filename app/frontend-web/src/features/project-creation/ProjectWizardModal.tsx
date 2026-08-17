import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStudioStore } from "@/store/useStudioStore";
import { useProductionStore } from "@/store/useProductionStore";
import { Modal } from "@/components/ui/Modal";
import { Stepper } from "@/components/ui/Stepper";
import { Step1BasicInfo } from "./Step1BasicInfo";
import { Step2ImportStory } from "./Step2ImportStory";
import { Step3AiAnalysis } from "./Step3AiAnalysis";
import { Step4Results } from "./Step4Results";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { api, apiErrorMessage, ApiClientError } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ProjectWizardDraft } from "@/types/studio";
import type { ApiFieldError } from "@/types/api";

const languageCodes: Record<string, string> = {
  "Tiếng Việt": "vi-VN",
  English: "en",
  "日本語": "ja",
  "한국어": "ko",
};

export const ProjectWizardModal: React.FC = () => {
  const {
    isWizardOpen,
    closeWizard,
    wizardDraft,
    setWizardStep,
    selectProject,
    setScreen,
  } = useStudioStore();
  const setView = useProductionStore((state) => state.setView);
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ApiFieldError[]>([]);
  const workflowRef = useRef<{
    fingerprint: string;
    project: Awaited<ReturnType<typeof api.createProject>>;
    storyCreated: boolean;
  } | null>(null);

  const createProjectWorkflow = useMutation({
    mutationFn: async (draft: ProjectWizardDraft) => {
      const language = languageCodes[draft.language] ?? "vi-VN";
      const fingerprint = JSON.stringify({
        title: draft.title.trim(),
        storyText: draft.storyText.trim(),
        language,
        aspectRatio: draft.aspectRatio,
        quality: draft.quality,
        rightsAttestationAccepted: draft.rightsAttestationAccepted,
      });
      const existingWorkflow = workflowRef.current?.fingerprint === fingerprint ? workflowRef.current : null;
      const project = existingWorkflow?.project ?? await api.createProject({
          name: draft.title.trim(),
          sourceLanguage: language,
          narrationLanguage: language,
          metadataLanguage: language,
          imageAspectRatio: draft.aspectRatio,
          imageQualityTier: draft.quality.toUpperCase(),
        });
      workflowRef.current = existingWorkflow ?? { fingerprint, project, storyCreated: false };

      if (!workflowRef.current.storyCreated) {
        await api.createStoryVersion(project.id, {
          content: draft.storyText.trim(),
          sourceLanguage: language,
          rightsAttestationAccepted: draft.rightsAttestationAccepted,
          rightsPolicyVersion: "rights-v1.7",
          rightsBasis: "USER_ATTESTED",
        });
        workflowRef.current = { fingerprint, project, storyCreated: true };
      }
      const job = await api.enqueueAnalysis(project.id);
      return { project, job };
    },
    onSuccess: async ({ project }) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      workflowRef.current = null;
      selectProject(project.id);
      closeWizard();
      setScreen("project-workspace");
      setView("overview");
      setSubmitError(null);
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
      setSubmitError(apiErrorMessage(error, "Không thể tạo project từ backend."));
    },
  });

  const currentStep = wizardDraft.step;
  const [maxAccessibleStep, setMaxAccessibleStep] = useState<number>(currentStep);

  // Sync and update maxAccessibleStep when wizard is opened or step advances
  useEffect(() => {
    if (isWizardOpen) {
      setMaxAccessibleStep((prev) => Math.max(prev, wizardDraft.step));
    } else {
      setMaxAccessibleStep(1);
    }
  }, [isWizardOpen, wizardDraft.step]);

  if (!isWizardOpen) return null;

  const handleNext = () => {
    if (currentStep < 4) {
      const nextStep = (currentStep + 1) as 1 | 2 | 3 | 4;
      setMaxAccessibleStep((prev) => Math.max(prev, nextStep));
      setWizardStep(nextStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setWizardStep((currentStep - 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleStepClick = (stepId: number) => {
    if (stepId <= maxAccessibleStep) {
      setWizardStep(stepId as 1 | 2 | 3 | 4);
    }
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
      setSubmitError("Vui lòng nhập nội dung truyện trước khi phân tích.");
      setWizardStep(2);
      return;
    }
    if (!wizardDraft.rightsAttestationAccepted) {
      setValidationErrors([]);
      setSubmitError("Bạn cần xác nhận quyền sử dụng nội dung trước khi gửi lên backend.");
      setWizardStep(2);
      return;
    }
    setSubmitError(null);
    setValidationErrors([]);
    createProjectWorkflow.mutate(wizardDraft);
  };

  return (
    <Modal
      isOpen={isWizardOpen}
      onClose={closeWizard}
      maxWidth="6xl"
      className="p-0 border border-slate-800 bg-[#0d1420]"
    >
      {/* Wizard Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#090e18]">
        <div className="flex items-center gap-6">
          <span className="font-bold text-base text-white tracking-wide">
            {currentStep === 1 && "03. Tạo dự án mới"}
            {currentStep === 2 && "04. Nhập truyện"}
            {currentStep === 3 && "05. Phân tích AI – Tổng quan"}
            {currentStep === 4 && "06. Kết quả phân tích"}
          </span>
        </div>

        <button
          type="button"
          onClick={closeWizard}
          className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 p-1.5 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Body */}
      <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 min-h-[500px]">
        {/* Left Stepper Navigation Column */}
        <div className="border-b md:border-b-0 md:border-r border-slate-800/80 pb-4 md:pb-0">
          <Stepper
            currentStep={currentStep}
            maxAccessibleStep={maxAccessibleStep}
            onStepClick={handleStepClick}
          />
        </div>

        {/* Right Dynamic Step Form */}
        <div className="flex-1">
          {currentStep === 1 && (
            <Step1BasicInfo onNext={handleNext} onCancel={closeWizard} validationErrors={validationErrors} />
          )}
          {currentStep === 2 && (
            <Step2ImportStory onNext={handleNext} onBack={handleBack} validationErrors={validationErrors} />
          )}
          {currentStep === 3 && (
            <Step3AiAnalysis onNext={handleNext} onBack={handleBack} />
          )}
          {currentStep === 4 && (
            <Step4Results onBack={handleBack} />
          )}
        </div>
      </div>

      {/* Wizard Footer Controls matching Mockup */}
      <div className="px-8 py-4 bg-[#090e18] border-t border-slate-800/80 flex items-center justify-between">
        <div>
          {currentStep === 1 ? (
            <Button variant="secondary" onClick={closeWizard} size="md">
              Hủy
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleBack} size="md">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Quay lại
            </Button>
          )}
        </div>

        <div>
          {currentStep < 4 ? (
            <Button variant="primary" onClick={handleNext} size="md">
              <span>Tiếp tục</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          ) : (
            <Button
              variant="gradient"
              onClick={handleConfirm}
              disabled={createProjectWorkflow.isPending}
              size="md"
              className="shadow-[0_0_20px_rgba(124,58,237,0.5)]"
            >
              <Check className="w-4 h-4 mr-1.5" />
              <span>{createProjectWorkflow.isPending ? "Đang gửi lên backend…" : "Xác nhận & Tạo dự án"}</span>
            </Button>
          )}
        </div>
      </div>
      {(submitError || validationErrors.length > 0) && (
        <div className="border-t border-rose-500/20 bg-rose-950/20 px-8 py-3 text-xs text-rose-200">
          {submitError && <p>{submitError}</p>}
          {validationErrors.length > 0 && (
            <ul className="mt-2 space-y-1 text-rose-200/80">
              {validationErrors.map((fieldError, index) => (
                <li key={`${fieldError.field}-${index}`}>
                  <span className="font-medium">{fieldError.field}:</span>{" "}
                  {fieldError.message || fieldError.code || "Giá trị không hợp lệ."}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
};
