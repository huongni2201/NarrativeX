package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.storyboard.domain.enums.AdaptationMode;
import com.narrativex.backend.feature.storyboard.domain.enums.NarrationScriptStatus;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Assembled, coherent chapter narration script derived from ordered AudioCue entries.
 * Serves as the single authoritative input text for production VieNeu TTS synthesis.
 */
public final class NarrationScript extends DomainEntity {
  private static final Pattern SHA256_PATTERN = Pattern.compile("^[0-9a-f]{64}$");

  private final UUID chapterId;
  private final UUID storyboardRevisionId;
  private final String sourceHash;
  private final int version;
  private final AdaptationMode adaptationMode;
  private String text;
  private String contentHash;
  private NarrationScriptStatus status;

  public NarrationScript(
      UUID chapterId,
      UUID storyboardRevisionId,
      String sourceHash,
      int version,
      AdaptationMode adaptationMode,
      String text,
      String contentHash) {
    this(
        null,
        0L,
        chapterId,
        storyboardRevisionId,
        sourceHash,
        version,
        adaptationMode,
        text,
        contentHash,
        NarrationScriptStatus.DRAFT);
  }

  private NarrationScript(
      UUID id,
      long rowVersion,
      UUID chapterId,
      UUID storyboardRevisionId,
      String sourceHash,
      int version,
      AdaptationMode adaptationMode,
      String text,
      String contentHash,
      NarrationScriptStatus status) {
    super(id, rowVersion);
    this.chapterId = Objects.requireNonNull(chapterId, "chapterId must not be null");
    this.storyboardRevisionId = Objects.requireNonNull(storyboardRevisionId, "storyboardRevisionId must not be null");
    this.sourceHash = validateHash(sourceHash, "sourceHash");
    if (version < 1) {
      throw new IllegalArgumentException("version must be positive, got " + version);
    }
    this.version = version;
    this.adaptationMode = Objects.requireNonNull(adaptationMode, "adaptationMode must not be null");
    this.text = Objects.requireNonNull(text, "text must not be null");
    this.contentHash = validateHash(contentHash, "contentHash");
    this.status = Objects.requireNonNull(status, "status must not be null");
  }

  public static NarrationScript rehydrate(
      UUID id,
      long rowVersion,
      UUID chapterId,
      UUID storyboardRevisionId,
      String sourceHash,
      int version,
      AdaptationMode adaptationMode,
      String text,
      String contentHash,
      NarrationScriptStatus status) {
    return new NarrationScript(
        id,
        rowVersion,
        chapterId,
        storyboardRevisionId,
        sourceHash,
        version,
        adaptationMode,
        text,
        contentHash,
        status);
  }

  public void markReady() {
    this.status = NarrationScriptStatus.READY;
  }

  public void approve() {
    this.status = NarrationScriptStatus.APPROVED;
  }

  public void supersede() {
    this.status = NarrationScriptStatus.SUPERSEDED;
  }

  public UUID getChapterId() {
    return chapterId;
  }

  public UUID getStoryboardRevisionId() {
    return storyboardRevisionId;
  }

  public String getSourceHash() {
    return sourceHash;
  }

  public int getVersion() {
    return version;
  }

  public AdaptationMode getAdaptationMode() {
    return adaptationMode;
  }

  public String getText() {
    return text;
  }

  public String getContentHash() {
    return contentHash;
  }

  public NarrationScriptStatus getStatus() {
    return status;
  }

  private static String validateHash(String hash, String field) {
    if (hash == null || !SHA256_PATTERN.matcher(hash).matches()) {
      throw new IllegalArgumentException(field + " must be a 64-character lowercase hex SHA-256 string");
    }
    return hash;
  }
}
