package com.narrativex.backend.feature.character.domain.aggregate;

import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.domain.entity.CharacterVoiceProfile;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.character.domain.exception.ArchivedCharacterException;
import com.narrativex.backend.feature.character.domain.exception.CharacterPersistenceRequiredException;
import com.narrativex.backend.feature.common.domain.AggregateRoot;
import com.narrativex.backend.feature.common.domain.enums.VoiceReferenceScope;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Reusable identity aggregate, never duplicated per project. */
public final class Character extends AggregateRoot {
  private final String canonicalName;
  private final List<String> aliases;
  private CharacterStatus status;
  private UUID pinnedVoiceProfileId;

  private Character(
      UUID id,
      long rowVersion,
      String canonicalName,
      List<String> aliases,
      CharacterStatus status,
      UUID pinnedVoiceProfileId) {
    super(id, rowVersion);
    this.canonicalName = required(canonicalName, "canonicalName");
    this.aliases = List.copyOf(aliases == null ? List.of() : aliases);
    this.status = Objects.requireNonNull(status, "status");
    this.pinnedVoiceProfileId = pinnedVoiceProfileId;
  }

  public static Character create(String canonicalName, List<String> aliases) {
    return new Character(null, 0L, canonicalName, aliases, CharacterStatus.ACTIVE, null);
  }

  public static Character rehydrate(
      UUID id,
      long rowVersion,
      String canonicalName,
      List<String> aliases,
      CharacterStatus status) {
    return new Character(id, rowVersion, canonicalName, aliases, status, null);
  }

  public static Character rehydrate(
      UUID id,
      long rowVersion,
      String canonicalName,
      List<String> aliases,
      CharacterStatus status,
      UUID pinnedVoiceProfileId) {
    return new Character(id, rowVersion, canonicalName, aliases, status, pinnedVoiceProfileId);
  }

  public CharacterVersion createVersion(int versionNumber, String bible, String visualPrompt) {
    ensureVersionCanBeCreated();
    return CharacterVersion.create(getId(), versionNumber, bible, visualPrompt);
  }

  public CharacterVoiceProfile createVoiceProfile(
      int versionNumber,
      UUID referenceAssetId,
      VoiceReferenceScope referenceScope,
      String language,
      String accent,
      String voiceDescription,
      String deliveryBaseline) {
    ensureVersionCanBeCreated();
    return CharacterVoiceProfile.create(
        getId(),
        versionNumber,
        referenceAssetId,
        referenceScope,
        language,
        accent,
        voiceDescription,
        deliveryBaseline);
  }

  public void pinVoiceProfile(UUID voiceProfileId) {
    if (status == CharacterStatus.ARCHIVED) {
      throw new ArchivedCharacterException();
    }
    this.pinnedVoiceProfileId = voiceProfileId;
  }

  public void unpinVoiceProfile() {
    this.pinnedVoiceProfileId = null;
  }

  public void archive() {
    if (status == CharacterStatus.ARCHIVED) return;
    status = CharacterStatus.ARCHIVED;
  }

  private void ensureVersionCanBeCreated() {
    if (getId() == null) throw new CharacterPersistenceRequiredException();
    if (status == CharacterStatus.ARCHIVED) throw new ArchivedCharacterException();
  }

  public String getCanonicalName() {
    return canonicalName;
  }

  public List<String> getAliases() {
    return aliases;
  }

  public CharacterStatus getStatus() {
    return status;
  }

  public UUID getPinnedVoiceProfileId() {
    return pinnedVoiceProfileId;
  }

  private static String required(String value, String field) {
    if (value == null || value.isBlank())
      throw new IllegalArgumentException(field + " must not be blank");
    return value;
  }
}
