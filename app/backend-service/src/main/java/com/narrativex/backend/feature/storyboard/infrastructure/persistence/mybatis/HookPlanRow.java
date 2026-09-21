package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class HookPlanRow {
  private UUID id;
  private long rowVersion;
  private Instant createdAt;
  private Instant updatedAt;
  private UUID chapterId;
  private String promise;
  private String conflict;
  private String curiosityQuestion;
  private String visualHook;
  private String dialogueHook;
  private String withheldInformation;
  private UUID payoffBeatId;
}
