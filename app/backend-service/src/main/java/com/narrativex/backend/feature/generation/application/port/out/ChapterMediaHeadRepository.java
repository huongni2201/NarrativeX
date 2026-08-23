package com.narrativex.backend.feature.generation.application.port.out;

/** Maintains the authoritative visual-generation job selected for a chapter. */
public interface ChapterMediaHeadRepository {
  void setCurrent(Long chapterId, Long generationJobId);
}
