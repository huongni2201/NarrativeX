export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
}

export interface FieldViolation {
  field: string;
  code: string;
  messageKey: string;
  message: string;
}

export interface CursorPage<T> {
  content: T[];
  nextCursor: string | null;
  limit: number;
  hasNext: boolean;
}
