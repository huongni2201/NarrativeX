package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.storyboard.domain.enums.AttentionEventType;
import java.util.Objects;
import java.util.UUID;

/** Sensory or narrative shift within the retention map that resets viewer attention. */
public final class AttentionEvent extends DomainEntity {
  private final UUID retentionMapId;
  private final AttentionEventType eventType;
  private final long timeOffsetMs;
  private final String description;
  private final String severity;

  public AttentionEvent(
      UUID retentionMapId,
      AttentionEventType eventType,
      long timeOffsetMs,
      String description,
      String severity) {
    this(null, 0L, retentionMapId, eventType, timeOffsetMs, description, severity);
  }

  public AttentionEvent(
      UUID id,
      long rowVersion,
      UUID retentionMapId,
      AttentionEventType eventType,
      long timeOffsetMs,
      String description,
      String severity) {
    super(id, rowVersion);
    this.retentionMapId = Objects.requireNonNull(retentionMapId, "retentionMapId must not be null");
    this.eventType = Objects.requireNonNull(eventType, "eventType must not be null");
    this.timeOffsetMs = timeOffsetMs;
    this.description = description != null ? description.trim() : "";
    this.severity = severity != null ? severity.trim() : "INFO";
  }

  public UUID getRetentionMapId() {
    return retentionMapId;
  }

  public AttentionEventType getEventType() {
    return eventType;
  }

  public long getTimeOffsetMs() {
    return timeOffsetMs;
  }

  public String getDescription() {
    return description;
  }

  public String getSeverity() {
    return severity;
  }
}
