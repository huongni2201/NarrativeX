package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.storyboard.domain.enums.AdaptationAction;
import com.narrativex.backend.feature.storyboard.domain.enums.AudioCueStatus;
import com.narrativex.backend.feature.storyboard.domain.enums.AudioCueType;
import java.util.Objects;
import java.util.UUID;

/**
 * Represents what the audience should hear during a StoryBeat. Encapsulates dialogue, inner
 * monologue, system cues, or narration along with source text range and adaptation policy
 * (KEEP_EXACT, LIGHT_EDIT, COMPRESS, VISUAL_PRIMARY).
 */
public final class AudioCue extends DomainEntity {
  private final UUID storyBeatId;
  private final int orderIndex;
  private final AudioCueType cueType;
  private final UUID speakerProjectCharacterId;
  private final Integer sourceStart;
  private final Integer sourceEnd;
  private final String sourceAnchorJson;
  private final AdaptationAction adaptationAction;
  private String adaptedText;
  private final String deliveryHint;
  private Integer narrationTextStart;
  private Integer narrationTextEnd;
  private Long audioStartMs;
  private Long audioEndMs;
  private AudioCueStatus status;

  public AudioCue(
      UUID storyBeatId,
      int orderIndex,
      AudioCueType cueType,
      UUID speakerProjectCharacterId,
      Integer sourceStart,
      Integer sourceEnd,
      String sourceAnchorJson,
      AdaptationAction adaptationAction,
      String adaptedText,
      String deliveryHint) {
    this(
        null,
        0L,
        storyBeatId,
        orderIndex,
        cueType,
        speakerProjectCharacterId,
        sourceStart,
        sourceEnd,
        sourceAnchorJson,
        adaptationAction,
        adaptedText,
        deliveryHint,
        null,
        null,
        null,
        null,
        AudioCueStatus.DRAFT);
  }

  private AudioCue(
      UUID id,
      long rowVersion,
      UUID storyBeatId,
      int orderIndex,
      AudioCueType cueType,
      UUID speakerProjectCharacterId,
      Integer sourceStart,
      Integer sourceEnd,
      String sourceAnchorJson,
      AdaptationAction adaptationAction,
      String adaptedText,
      String deliveryHint,
      Integer narrationTextStart,
      Integer narrationTextEnd,
      Long audioStartMs,
      Long audioEndMs,
      AudioCueStatus status) {
    super(id, rowVersion);
    this.storyBeatId = Objects.requireNonNull(storyBeatId, "storyBeatId must not be null");
    if (orderIndex < 0) {
      throw new IllegalArgumentException("orderIndex must not be negative");
    }
    this.orderIndex = orderIndex;
    this.cueType = Objects.requireNonNull(cueType, "cueType must not be null");
    this.speakerProjectCharacterId = speakerProjectCharacterId;
    if (sourceStart != null && sourceEnd != null) {
      if (sourceStart < 0 || sourceEnd <= sourceStart) {
        throw new IllegalArgumentException(
            "sourceStart must be >= 0 and < sourceEnd, got ["
                + sourceStart
                + ", "
                + sourceEnd
                + "]");
      }
    }
    this.sourceStart = sourceStart;
    this.sourceEnd = sourceEnd;
    this.sourceAnchorJson = sourceAnchorJson;
    this.adaptationAction =
        Objects.requireNonNull(adaptationAction, "adaptationAction must not be null");
    this.adaptedText = adaptedText != null ? adaptedText.trim() : null;
    this.deliveryHint = deliveryHint != null ? deliveryHint.trim() : null;
    this.narrationTextStart = narrationTextStart;
    this.narrationTextEnd = narrationTextEnd;
    this.audioStartMs = audioStartMs;
    this.audioEndMs = audioEndMs;
    this.status = Objects.requireNonNull(status, "status must not be null");
  }

  public static AudioCue rehydrate(
      UUID id,
      long rowVersion,
      UUID storyBeatId,
      int orderIndex,
      AudioCueType cueType,
      UUID speakerProjectCharacterId,
      Integer sourceStart,
      Integer sourceEnd,
      String sourceAnchorJson,
      AdaptationAction adaptationAction,
      String adaptedText,
      String deliveryHint,
      Integer narrationTextStart,
      Integer narrationTextEnd,
      Long audioStartMs,
      Long audioEndMs,
      AudioCueStatus status) {
    return new AudioCue(
        id,
        rowVersion,
        storyBeatId,
        orderIndex,
        cueType,
        speakerProjectCharacterId,
        sourceStart,
        sourceEnd,
        sourceAnchorJson,
        adaptationAction,
        adaptedText,
        deliveryHint,
        narrationTextStart,
        narrationTextEnd,
        audioStartMs,
        audioEndMs,
        status);
  }

  public void updateAdaptedText(String newAdaptedText) {
    this.adaptedText = newAdaptedText != null ? newAdaptedText.trim() : null;
  }

  public void updateNarrationOffsets(int textStart, int textEnd) {
    if (textStart < 0 || textEnd < textStart) {
      throw new IllegalArgumentException(
          "Invalid narration offsets: [" + textStart + ", " + textEnd + "]");
    }
    this.narrationTextStart = textStart;
    this.narrationTextEnd = textEnd;
  }

  public void updateAudioTiming(long startMs, long endMs) {
    if (startMs < 0 || endMs < startMs) {
      throw new IllegalArgumentException("Invalid audio timing: [" + startMs + ", " + endMs + "]");
    }
    this.audioStartMs = startMs;
    this.audioEndMs = endMs;
  }

  public void changeStatus(AudioCueStatus newStatus) {
    this.status = Objects.requireNonNull(newStatus, "newStatus must not be null");
  }

  public UUID getStoryBeatId() {
    return storyBeatId;
  }

  public int getOrderIndex() {
    return orderIndex;
  }

  public AudioCueType getCueType() {
    return cueType;
  }

  public UUID getSpeakerProjectCharacterId() {
    return speakerProjectCharacterId;
  }

  public Integer getSourceStart() {
    return sourceStart;
  }

  public Integer getSourceEnd() {
    return sourceEnd;
  }

  public String getSourceAnchorJson() {
    return sourceAnchorJson;
  }

  public AdaptationAction getAdaptationAction() {
    return adaptationAction;
  }

  public String getAdaptedText() {
    return adaptedText;
  }

  public String getDeliveryHint() {
    return deliveryHint;
  }

  public Integer getNarrationTextStart() {
    return narrationTextStart;
  }

  public Integer getNarrationTextEnd() {
    return narrationTextEnd;
  }

  public Long getAudioStartMs() {
    return audioStartMs;
  }

  public Long getAudioEndMs() {
    return audioEndMs;
  }

  public AudioCueStatus getStatus() {
    return status;
  }
}
