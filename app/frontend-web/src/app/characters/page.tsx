"use client";

import { useEffect } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import HomePage from "../page";

export default function CharactersPage() {
  const setScreen = useStudioStore((state) => state.setScreen);

  useEffect(() => {
    setScreen("characters");
  }, [setScreen]);

  return <HomePage />;
}
