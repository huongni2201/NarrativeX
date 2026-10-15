package com.narrativex.backend.feature.generation.application.port.out;

import java.util.List;
import java.util.UUID;

/**
 * Aggregate read model for the chapter production status endpoint. It never loads shot, take or
 * selected-take rows; everything is counted in the database.
 */
public interface ChapterProductionStatusRepository {
  ShotAggregate aggregate(UUID projectId, UUID chapterId);

  /** Shots of the chapter grouped by visual beat and strategy (needed for preflight blockers). */
  List<ShotStrategyGroup> shotStrategyGroups(UUID projectId, UUID chapterId);

  /** {@code strategy} is the raw column value and may be null. */
  record ShotStrategyGroup(UUID visualBeatId, String strategy, int shots) {}

  /**
   * @param passed shots whose status is PASSED or SELECTED
   * @param selected shots that have a selected take
   * @param changeMarker opaque text that changes whenever a shot, take, selected take, visual beat
   *     or audio cue of the chapter changes
   */
  record ShotAggregate(
      int total,
      int queued,
      int generating,
      int validating,
      int passed,
      int failed,
      int manualReview,
      int selected,
      String changeMarker) {}
}
