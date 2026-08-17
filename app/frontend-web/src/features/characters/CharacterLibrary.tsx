"use client";

import dynamic from "next/dynamic";
import { isMockDataMode } from "@/lib/data-mode";
import { CharacterLibraryUnavailable } from "./components/CharacterLibraryUnavailable";

const CharacterLibraryDemo = dynamic(() =>
  import("./CharacterLibraryDemo").then((module) => module.CharacterLibraryDemo),
);

export function CharacterLibrary() {
  if (!isMockDataMode) {
    return <CharacterLibraryUnavailable />;
  }

  return <CharacterLibraryDemo />;
}
