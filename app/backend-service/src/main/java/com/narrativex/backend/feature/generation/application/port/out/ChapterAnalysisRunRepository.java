package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.entity.ChapterAnalysisRun;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Outbound port for recording and querying durable chapter analysis telemetry and provenance. */
public interface ChapterAnalysisRunRepository {

  /** Persists a completed chapter analysis run record. */
  ChapterAnalysisRun recordRun(ChapterAnalysisRun run);

  /** Finds the latest analysis run for a chapter. */
  Optional<ChapterAnalysisRun> findLatestByChapterId(UUID chapterId);

  /** Finds all analysis runs for a chapter ordered by createdAt DESC. */
  List<ChapterAnalysisRun> findByChapterId(UUID chapterId);

  /** Finds the analysis run associated with a specific generation job. */
  Optional<ChapterAnalysisRun> findByJobId(UUID generationJobId);
}
