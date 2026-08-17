// Shared frontend type definitions foundation
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  timestamp: string;
}
