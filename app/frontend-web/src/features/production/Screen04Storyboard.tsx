import React, { useEffect } from "react";
import { useProductionStore } from "@/store/useProductionStore";
import { Screen03ChapterWorkspace } from "./Screen03ChapterWorkspace";

export const Screen04Storyboard: React.FC = () => {
  const { setActiveWorkspaceTab } = useProductionStore();

  useEffect(() => {
    setActiveWorkspaceTab("storyboard");
  }, [setActiveWorkspaceTab]);

  return <Screen03ChapterWorkspace />;
};
