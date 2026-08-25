package com.narrativex.backend.feature.character.domain.entity;

import com.narrativex.backend.feature.character.domain.enums.CharacterVersionStatus;
import com.narrativex.backend.feature.character.domain.exception.InvalidCharacterVersionTransitionException;
import com.narrativex.backend.feature.common.domain.DomainEntity;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Immutable-after-lock identity/Bible snapshot owned by Character. Media references are modeled
 * separately.
 */
public final class CharacterVersion extends DomainEntity {
  private final UUID characterId;
  private final int versionNumber;
  private final String bible;
  private final String visualPrompt;
  private CharacterVersionStatus status;
  private Instant lockedAt;
  private String lockedBy;

  private CharacterVersion(
      UUID id,
      long rowVersion,
      UUID characterId,
      int versionNumber,
      String bible,
      String visualPrompt,
      CharacterVersionStatus status,
      Instant lockedAt,
      String lockedBy) {
    super(id, rowVersion);
    this.characterId = Objects.requireNonNull(characterId, "characterId");
    if (versionNumber <= 0) throw new IllegalArgumentException("versionNumber must be positive");
    this.versionNumber = versionNumber;
    this.bible = required(bible, "bible");
    this.visualPrompt = required(visualPrompt, "visualPrompt");
    this.status = Objects.requireNonNull(status, "status");
    this.lockedAt = lockedAt;
    this.lockedBy = lockedBy;
  }

  public static CharacterVersion create(
      UUID characterId, int versionNumber, String bible, String visualPrompt) {
    return new CharacterVersion(
        null,
        0L,
        characterId,
        versionNumber,
        bible,
        visualPrompt,
        CharacterVersionStatus.DRAFT,
        null,
        null);
  }

  public static CharacterVersion rehydrate(
      UUID id,
      long rowVersion,
      UUID characterId,
      int versionNumber,
      String bible,
      String visualPrompt,
      CharacterVersionStatus status,
      Instant lockedAt,
      String lockedBy) {
    return new CharacterVersion(
        id,
        rowVersion,
        characterId,
        versionNumber,
        bible,
        visualPrompt,
        status,
        lockedAt,
        lockedBy);
  }

  public void submitForReview() {
    if (status != CharacterVersionStatus.DRAFT && status != CharacterVersionStatus.GENERATING) {
      throw new InvalidCharacterVersionTransitionException(
          "Only draft or generating versions can enter review");
    }
    status = CharacterVersionStatus.REVIEW;
  }

  public void lock(String actorId) {
    if (status != CharacterVersionStatus.REVIEW) {
      throw new InvalidCharacterVersionTransitionException(
          "Only reviewed character versions can be locked");
    }
    String resolvedActorId = required(actorId, "actorId");
    status = CharacterVersionStatus.LOCKED;
    lockedAt = Instant.now();
    lockedBy = resolvedActorId;
  }

  public UUID getCharacterId() {
    return characterId;
  }

  public int getVersionNumber() {
    return versionNumber;
  }

  public String getBible() {
    return bible;
  }

  public String getVisualPrompt() {
    return visualPrompt;
  }

  public CharacterVersionStatus getStatus() {
    return status;
  }

  public Instant getLockedAt() {
    return lockedAt;
  }

  public String getLockedBy() {
    return lockedBy;
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank())
      throw new IllegalArgumentException(field + " must not be blank");
    return value;
  }
}
