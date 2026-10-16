package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.LocationCanon;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Read-only projection that resolves, by ID, the Location a Shot belongs to (Shot → ShotSequence →
 * VisualBeat → Scene → {@code project_location_id}) and the Shot that precedes it inside the same
 * Scene. {@code shots.location_ref} is never consulted here.
 */
public interface ShotLocationContextRepository {

  /** Resolves every requested Shot in one bounded query; unknown Shots are absent from the map. */
  Map<UUID, ShotLocationContext> findForShots(UUID projectId, List<UUID> shotIds);

  default ShotLocationContext findForShot(UUID projectId, UUID shotId) {
    return findForShots(projectId, List.of(shotId)).getOrDefault(shotId, ShotLocationContext.NONE);
  }

  /**
   * @param location the Scene's Location, or null when the Scene has none
   * @param previousShotId the Shot immediately before this one in the same Scene, or null for the
   *     first Shot of the Scene
   * @param previousEndStateJson that previous Shot's {@code end_state_json}
   */
  record ShotLocationContext(
      LocationCanon location, UUID previousShotId, String previousEndStateJson) {

    public static final ShotLocationContext NONE = new ShotLocationContext(null, null, null);
  }
}
