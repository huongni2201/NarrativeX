package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ShotAudioCueAllocationRow {
  private UUID sequenceId;
  private UUID audioCueId;
  private UUID shotId;
  private long audioCueRowVersion;
}
