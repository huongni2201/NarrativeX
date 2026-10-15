package com.narrativex.backend.feature.character.domain.entity;

import com.narrativex.backend.feature.character.domain.enums.CharacterReferencePolicy;
import com.narrativex.backend.feature.character.domain.enums.CharacterVersionStatus;
import com.narrativex.backend.feature.character.domain.exception.InvalidCharacterVersionTransitionException;
import com.narrativex.backend.feature.character.domain.value.CharacterVisualProfile;
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
  private final CharacterReferencePolicy referencePolicy;
  private final CharacterVisualProfile visualProfile;
  private final UUID basedOnVersionId;
  private CharacterVersionStatus status;
  private Instant lockedAt;

  private CharacterVersion(
      UUID id,
      long rowVersion,
      UUID characterId,
      int versionNumber,
      String bible,
      String visualPrompt,
      CharacterVersionStatus status,
      Instant lockedAt,
      CharacterReferencePolicy referencePolicy,
      CharacterVisualProfile visualProfile,
      UUID basedOnVersionId) {
    super(id, rowVersion);
    this.characterId = Objects.requireNonNull(characterId, "characterId");
    if (versionNumber <= 0) throw new IllegalArgumentException("versionNumber must be positive");
    this.versionNumber = versionNumber;
    this.bible = required(bible, "bible");
    this.visualPrompt = required(visualPrompt, "visualPrompt");
    this.referencePolicy = Objects.requireNonNull(referencePolicy, "referencePolicy");
    if ((referencePolicy == CharacterReferencePolicy.MULTI_VIEW_V1) != (visualProfile != null)) {
      throw new IllegalArgumentException("MULTI_VIEW_V1 requires exactly one visual profile");
    }
    this.visualProfile = visualProfile;
    this.basedOnVersionId = basedOnVersionId;
    this.status = Objects.requireNonNull(status, "status");
    this.lockedAt = lockedAt;
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
        CharacterReferencePolicy.LEGACY_IDENTITY_V1,
        null,
        null);
  }

  public static CharacterVersion createMultiView(
      UUID characterId,
      int versionNumber,
      String bible,
      CharacterVisualProfile visualProfile,
      UUID basedOnVersionId) {
    Objects.requireNonNull(visualProfile, "visualProfile");
    return new CharacterVersion(
        null,
        0L,
        characterId,
        versionNumber,
        bible,
        visualProfile.toVisualPrompt(),
        CharacterVersionStatus.DRAFT,
        null,
        CharacterReferencePolicy.MULTI_VIEW_V1,
        visualProfile,
        basedOnVersionId);
  }

  public static CharacterVersion rehydrate(
      UUID id,
      long rowVersion,
      UUID characterId,
      int versionNumber,
      String bible,
      String visualPrompt,
      CharacterVersionStatus status,
      Instant lockedAt) {
    return new CharacterVersion(
        id,
        rowVersion,
        characterId,
        versionNumber,
        bible,
        visualPrompt,
        status,
        lockedAt,
        CharacterReferencePolicy.LEGACY_IDENTITY_V1,
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
      CharacterReferencePolicy referencePolicy,
      CharacterVisualProfile visualProfile,
      UUID basedOnVersionId) {
    return new CharacterVersion(
        id,
        rowVersion,
        characterId,
        versionNumber,
        bible,
        visualPrompt,
        status,
        lockedAt,
        referencePolicy,
        visualProfile,
        basedOnVersionId);
  }

  public void submitForReview() {
    if (status != CharacterVersionStatus.DRAFT && status != CharacterVersionStatus.GENERATING) {
      throw new InvalidCharacterVersionTransitionException(
          "Only draft or generating versions can enter review");
    }
    status = CharacterVersionStatus.REVIEW;
  }

  public void lock() {
    if (status != CharacterVersionStatus.REVIEW) {
      throw new InvalidCharacterVersionTransitionException(
          "Only reviewed character versions can be locked");
    }
    status = CharacterVersionStatus.LOCKED;
    lockedAt = Instant.now();
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

  public CharacterReferencePolicy getReferencePolicy() {
    return referencePolicy;
  }

  public CharacterVisualProfile getVisualProfile() {
    return visualProfile;
  }

  public UUID getBasedOnVersionId() {
    return basedOnVersionId;
  }

  public CharacterVersionStatus getStatus() {
    return status;
  }

  public Instant getLockedAt() {
    return lockedAt;
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank())
      throw new IllegalArgumentException(field + " must not be blank");
    return value;
  }
}
