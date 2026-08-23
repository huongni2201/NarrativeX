package com.narrativex.backend.feature.character.application.usecase;

import com.narrativex.backend.feature.assets.application.port.in.MediaAssetAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionReferenceRepository;
import com.narrativex.backend.feature.character.application.port.out.CharacterVersionRepository;
import com.narrativex.backend.feature.character.domain.enums.CharacterVersionStatus;
import com.narrativex.backend.feature.character.domain.value.CharacterVersionReference;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SetCharacterVersionReferencesUseCase {
  private static final int MAX_SAVED_REFERENCES = 8;
  private static final Set<String> ALLOWED_ROLES =
      Set.of("IDENTITY", "PROFILE", "EXPRESSION", "OUTFIT", "POSE");

  private final CurrentUserId currentUserId;
  private final CharacterVersionRepository versionRepository;
  private final CharacterVersionReferenceRepository referenceRepository;
  private final MediaAssetAccess mediaAssetAccess;

  @Transactional
  public List<CharacterVersionReference> execute(
      UUID characterId, UUID versionId, List<ReferenceInput> inputs) {
    String ownerId = currentUserId.get();
    var version =
        versionRepository
            .findOwnedById(versionId, ownerId)
            .orElseThrow(() -> new ResourceNotFoundException("Character version not found"));
    if (!version.getCharacterId().equals(characterId)) {
      throw new ResourceNotFoundException("Character version not found");
    }
    if (version.getStatus() == CharacterVersionStatus.LOCKED) {
      throw new ResourceConflictException("Locked character versions are immutable");
    }

    List<ReferenceInput> safeInputs = inputs == null ? List.of() : List.copyOf(inputs);
    if (safeInputs.size() > MAX_SAVED_REFERENCES) {
      throw new IllegalArgumentException("A character version can save at most 8 references");
    }

    Set<UUID> assetIds = new HashSet<>();
    Set<Integer> priorities = new HashSet<>();
    for (ReferenceInput input : safeInputs) {
      if (input == null || input.assetId() == null) {
        throw new IllegalArgumentException("Reference assetId must not be null");
      }
      String role = normalizedRole(input.role());
      if (!ALLOWED_ROLES.contains(role)) {
        throw new IllegalArgumentException("Unsupported character reference role: " + role);
      }
      if (input.priority() < 0 || input.priority() > 99) {
        throw new IllegalArgumentException("Reference priority must be between 0 and 99");
      }
      if (!assetIds.add(input.assetId())) {
        throw new IllegalArgumentException("Duplicate character reference asset");
      }
      if (!priorities.add(input.priority())) {
        throw new IllegalArgumentException("Duplicate character reference priority");
      }

      var asset =
          mediaAssetAccess
              .findOwnedSummary(ownerId, input.assetId())
              .orElseThrow(() -> new ResourceNotFoundException("Reference media asset not found"));
      if (!"IMAGE".equals(asset.type()) || !"READY".equals(asset.status())) {
        throw new ResourceConflictException("Character references must be READY image assets");
      }
      String contentType =
          asset.detectedContentType() != null ? asset.detectedContentType() : asset.contentType();
      if (contentType == null || !contentType.startsWith("image/")) {
        throw new ResourceConflictException("Character reference content must be an image");
      }
    }

    List<CharacterVersionReference> references =
        safeInputs.stream()
            .map(
                input ->
                    new CharacterVersionReference(
                        input.assetId(), normalizedRole(input.role()), input.priority()))
            .sorted(
                Comparator.comparingInt(CharacterVersionReference::priority)
                    .thenComparing(CharacterVersionReference::mediaAssetId))
            .toList();
    if (!references.isEmpty() && !"IDENTITY".equals(references.getFirst().role())) {
      throw new IllegalArgumentException("The highest-priority character reference must be IDENTITY");
    }
    referenceRepository.replace(versionId, references);
    return references;
  }

  private static String normalizedRole(String role) {
    return role == null || role.isBlank() ? "IDENTITY" : role.trim().toUpperCase();
  }

  public record ReferenceInput(UUID assetId, String role, int priority) {}
}
