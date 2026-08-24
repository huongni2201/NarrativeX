export interface DesktopProject {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  isStarred?: boolean;
  metrics?: {
    totalChapters: number;
    totalScenes: number;
    estimatedDurationSeconds: number;
  };
}
