package com.narrativex.backend.feature.character.domain.entity;

import com.narrativex.backend.feature.character.domain.enums.CharacterVoiceProfileStatus;
import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.common.domain.enums.VoiceReferenceScope;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Pinned voice identity profile for a Character, establishing vocal characteristics, delivery
 * style, and voice reference audio asset binding.
 */
public final class CharacterVoiceProfile extends DomainEntity {
  private final UUID characterId;
  private final int versionNumber;
  private UUID referenceAssetId;
  private VoiceReferenceScope referenceScope;
  private String language;
  private String accent;
  private String voiceDescription;
  private String deliveryBaseline;
  private CharacterVoiceProfileStatus status;
  private Instant lockedAt;

  private CharacterVoiceProfile(
      UUID id,
      long rowVersion,
      UUID characterId,
      int versionNumber,
      UUID referenceAssetId,
      VoiceReferenceScope referenceScope,
      String language,
      String accent,
      String voiceDescription,
      String deliveryBaseline,
      CharacterVoiceProfileStatus status,
      Instant lockedAt) {
    super(id, rowVersion);
    this.characterId = Objects.requireNonNull(characterId, "characterId");
    if (versionNumber <= 0) {
      throw new IllegalArgumentException("versionNumber must be positive");
    }
    this.versionNumber = versionNumber;
    this.referenceAssetId = referenceAssetId;
    this.referenceScope =
        referenceScope != null ? referenceScope : VoiceReferenceScope.GLOBAL_LOCAL;
    this.language = language != null && !language.isBlank() ? language : "vi-VN";
    this.accent = accent;
    this.voiceDescription = voiceDescription != null ? voiceDescription : "";
    this.deliveryBaseline = deliveryBaseline != null ? deliveryBaseline : "";
    this.status = Objects.requireNonNull(status, "status");
    this.lockedAt = lockedAt;
  }

  public static CharacterVoiceProfile create(
      UUID characterId,
      int versionNumber,
      UUID referenceAssetId,
      VoiceReferenceScope referenceScope,
      String language,
      String accent,
      String voiceDescription,
      String deliveryBaseline) {
    return new CharacterVoiceProfile(
        null,
        0L,
        characterId,
        versionNumber,
        referenceAssetId,
        referenceScope,
        language,
        accent,
        voiceDescription,
        deliveryBaseline,
        CharacterVoiceProfileStatus.ACTIVE,
        null);
  }

  public static CharacterVoiceProfile rehydrate(
      UUID id,
      long rowVersion,
      UUID characterId,
      int versionNumber,
      UUID referenceAssetId,
      VoiceReferenceScope referenceScope,
      String language,
      String accent,
      String voiceDescription,
      String deliveryBaseline,
      CharacterVoiceProfileStatus status,
      Instant lockedAt) {
    return new CharacterVoiceProfile(
        id,
        rowVersion,
        characterId,
        versionNumber,
        referenceAssetId,
        referenceScope,
        language,
        accent,
        voiceDescription,
        deliveryBaseline,
        status,
        lockedAt);
  }

  public void lock() {
    this.lockedAt = Instant.now();
  }

  public void archive() {
    this.status = CharacterVoiceProfileStatus.ARCHIVED;
  }

  public UUID getCharacterId() {
    return characterId;
  }

  public int getVersionNumber() {
    return versionNumber;
  }

  public UUID getReferenceAssetId() {
    return referenceAssetId;
  }

  public VoiceReferenceScope getReferenceScope() {
    return referenceScope;
  }

  public String getLanguage() {
    return language;
  }

  public String getAccent() {
    return accent;
  }

  public String getVoiceDescription() {
    return voiceDescription;
  }

  public String getDeliveryBaseline() {
    return deliveryBaseline;
  }

  public CharacterVoiceProfileStatus getStatus() {
    return status;
  }

  public Instant getLockedAt() {
    return lockedAt;
  }
}
