package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Sequence of shots that collectively realize a dramatic VisualBeat. */
public final class ShotSequence extends DomainEntity {
  private final UUID visualBeatId;
  private final int orderIndex;
  private final List<Shot> shots;

  public ShotSequence(UUID visualBeatId, int orderIndex, List<Shot> shots) {
    this(null, 0L, visualBeatId, orderIndex, shots);
  }

  public ShotSequence(
      UUID id, long rowVersion, UUID visualBeatId, int orderIndex, List<Shot> shots) {
    super(id, rowVersion);
    this.visualBeatId = Objects.requireNonNull(visualBeatId, "visualBeatId must not be null");
    this.orderIndex = orderIndex;
    this.shots =
        shots != null
            ? Collections.unmodifiableList(new ArrayList<>(shots))
            : Collections.emptyList();
  }

  public UUID getVisualBeatId() {
    return visualBeatId;
  }

  public int getOrderIndex() {
    return orderIndex;
  }

  public List<Shot> getShots() {
    return shots;
  }
}
