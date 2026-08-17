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

export interface ApiAuthUser {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
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

export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
}

export interface PaginationResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ApiFieldError {
  field: string;
  code?: string;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  status: number;
  code: string;
  message: string;
  path?: string;
  correlationId?: string;
  errors?: ApiFieldError[];
  timestamp: string;
}
