import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { projectsApi } from "@/features/projects/api/projects.api";
import { queryKeys } from "@/lib/query-keys";
import { isProductionTab, type ProductionTab } from "../production.types";

export function useProjectWorkspace(projectId: number, initialTab: ProductionTab, enabled = true) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tabFromUrl = isProductionTab(requestedTab) ? requestedTab : initialTab;
  const [activeTab, setActiveTab] = useState<ProductionTab>(tabFromUrl);

  useEffect(() => setActiveTab(tabFromUrl), [tabFromUrl]);

  const overviewQuery = useQuery({
    queryKey: queryKeys.projectOverview(projectId),
    queryFn: () => projectsApi.getOverview(projectId),
    enabled,
  });
  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => projectsApi.getById(projectId),
    enabled,
  });
  const chapters = useMemo(() => overviewQuery.data?.chapters ?? [], [overviewQuery.data?.chapters]);
  const continueChapter = chapters.find((chapter) => chapter.status !== "RENDERED") ?? chapters.at(-1) ?? null;

  const changeTab = (nextTab: ProductionTab) => {
    setActiveTab(nextTab);
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextTab === "chapters") nextParams.delete("tab");
    else nextParams.set("tab", nextTab);
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return {
    activeTab,
    changeTab,
    chapters,
    continueChapter,
    overviewQuery,
    projectQuery,
    navigateToChapter: (chapterId: number) => router.push(`/projects/${projectId}/chapters/${chapterId}`),
    continueProject: () => {
      if (continueChapter) router.push(`/projects/${projectId}/chapters/${continueChapter.id}`);
    },
  };
}
