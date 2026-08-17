export interface ApiProject {
  id: number;
  name: string;
  status: string;
  sourceLanguage: string;
  narrationLanguage: string;
  metadataLanguage: string;
  imageAspectRatio: string;
  imageQualityTier: string;
  rowVersion: number;
}

export interface ApiStoryVersion {
  id: number;
  projectId: number;
  versionNumber: number;
  status: string;
  moderationDecision: string;
  rightsAttested: boolean;
  rightsPolicyVersion: string;
  rightsBasis: string;
  rightsAttestedAt: string | null;
  contentCharacterCount: number;
}

export interface ApiGenerationJob {
  jobId: string;
  type: string;
  status: string;
  progress: number;
  currentStep: string;
  entityType: string;
  entityId: number;
  errorCode: string | null;
}

export interface CreateProjectApiInput {
  name: string;
  sourceLanguage?: string;
  narrationLanguage?: string;
  metadataLanguage?: string;
  imageAspectRatio?: string;
  imageQualityTier?: string;
}

export interface CreateStoryVersionApiInput {
  content: string;
  sourceLanguage?: string;
  rightsAttestationAccepted: boolean;
  rightsPolicyVersion?: string;
  rightsBasis?: string;
}

export interface ApiFieldViolation {
  field: string;
  code?: string;
  messageKey?: string;
  message?: string;
}

export interface ApiProblem {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  messageKey?: string;
  path?: string;
  correlationId?: string;
  violations?: ApiFieldViolation[];
}
