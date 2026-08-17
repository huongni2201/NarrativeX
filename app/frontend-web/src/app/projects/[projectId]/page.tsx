"use client";

import { useParams } from "next/navigation";
import HomePage from "../../page";

export default function ProjectWorkspacePage() {
  const params = useParams<{ projectId: string }>();
  return <HomePage screen="project-workspace" projectId={params.projectId} />;
}
