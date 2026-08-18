import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStudioStore } from "@/store/useStudioStore";
import { Modal } from "@/components/ui/Modal";
import { Step1BasicInfo } from "./Step1BasicInfo";
import { Button } from "@/components/ui/Button";
import { Check, X } from "lucide-react";
import { projectsApi } from "@/features/projects/api/projects.api";
import { ApiClientError, apiErrorMessage } from "@/shared/api/client";
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const isWizardOpen = useStudioStore((state) => state.isWizardOpen);
  const closeWizard = useStudioStore((state) => state.closeWizard);
  const wizardDraft = useStudioStore((state) => state.wizardDraft);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ApiFieldError[]>([]);

  const createProject = useMutation({
    mutationFn: async (draft: ProjectWizardDraft) => {
      const language = languageCodes[draft.language] ?? "vi-VN";
      return projectsApi.create({
        name: draft.title.trim(),
        sourceLanguage: language,
        narrationLanguage: language,
        metadataLanguage: language,
        imageAspectRatio: draft.aspectRatio,
        imageQualityTier: draft.quality.toUpperCase(),
      });
    },
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      queryClient.setQueryData(queryKeys.project(project.id), project);
      setSubmitError(null);
      setValidationErrors([]);
      closeWizard();
      router.push(`/projects/${project.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiClientError) {
        setValidationErrors(error.errors ?? []);
        setSubmitError(error.message);
        return;
      }
      setValidationErrors([]);
      setSubmitError(apiErrorMessage(error, "Không thể tạo project từ backend."));
    },
  });

  if (!isWizardOpen) return null;

  const handleCloseWizard = () => {
    if (createProject.isPending) return;
    setSubmitError(null);
    setValidationErrors([]);
    createProject.reset();
    closeWizard();
  };

  const handleConfirm = () => {
    if (!wizardDraft.title.trim()) {
      setValidationErrors([]);
      setSubmitError("Vui lòng nhập tên dự án.");
      return;
    }
    setSubmitError(null);
    setValidationErrors([]);
    createProject.mutate(wizardDraft);
  };

  return (
    <Modal
      isOpen={isWizardOpen}
      onClose={handleCloseWizard}
      ariaLabel="Tạo dự án NarrativeX"
      closeDisabled={createProject.isPending}
      maxWidth="5xl"
      className="border border-slate-800 bg-[#0d1420] p-0"
    >
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-[#090e18] px-6 py-4">
        <div>
          <span className="text-base font-bold tracking-wide text-white">Tạo dự án mới</span>
          <p className="mt-1 text-xs text-slate-500">
            Chỉ tạo metadata project. Nội dung truyện và phân tích AI được thực hiện theo từng Chapter.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCloseWizard}
          disabled={createProject.isPending}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={createProject.isPending ? "Đang tạo dự án, chưa thể đóng" : "Đóng trình tạo dự án"}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-6 md:p-8">
        <Step1BasicInfo
          onNext={handleConfirm}
          onCancel={handleCloseWizard}
          validationErrors={validationErrors}
        />
      </div>

      <div className="flex items-center justify-between border-t border-slate-800/80 bg-[#090e18] px-8 py-4">
        <Button variant="secondary" onClick={handleCloseWizard} disabled={createProject.isPending}>
          Hủy
        </Button>
        <Button variant="gradient" onClick={handleConfirm} disabled={createProject.isPending}>
          <Check className="mr-1.5 h-4 w-4" />
          {createProject.isPending ? "Đang tạo dự án…" : "Tạo dự án"}
        </Button>
      </div>

      {(submitError || validationErrors.length > 0) && (
        <div
          className="border-t border-rose-500/20 bg-rose-950/20 px-8 py-3 text-xs text-rose-200"
          role="alert"
        >
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
