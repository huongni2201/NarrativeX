package com.narrativex.backend.feature.generation.infrastructure.compute;

import com.narrativex.backend.feature.assets.application.port.in.MediaStorageAccess;
import com.narrativex.backend.feature.assets.application.port.out.MediaAssetRepository;
import com.narrativex.backend.feature.assets.application.query.MediaAssetView;
import com.narrativex.backend.feature.assets.infrastructure.storage.ProjectLocalMediaAccess;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.compute.ArtifactReadAccessDto;
import com.narrativex.backend.feature.generation.application.model.compute.ArtifactWriteAccessDto;
import com.narrativex.backend.feature.generation.application.model.compute.InputArtifactRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Issues short-lived backend capabilities backed by the project-local media store.
 *
 * <p>The compute service never receives storage credentials. It can only PUT/GET the exact bytes
 * granted by a capability, while the backend verifies the resulting object before accepting a
 * terminal compute observation.
 */
@Component
@RequiredArgsConstructor
public class LocalComputeArtifactAccess implements ComputeArtifactAccess {
  private final ProjectLocalMediaAccess projectLocalMediaAccess;
  private final MediaStorageAccess mediaStorageAccess;
  private final MediaAssetRepository mediaAssetRepository;
  private final ComputeServiceProperties properties;
  private final Map<UUID, Binding> outputBindings = new ConcurrentHashMap<>();

  @Override
  public OutputArtifactTargetDto createOutput(
      UUID taskId, UUID attemptId, String role, String mediaType) {
    UUID artifactId = UuidV7.random();
    Instant expiresAt = Instant.now().plus(properties.getArtifactTtl());
    String storageKey =
        "private/provider-results/"
            + taskId
            + "/"
            + attemptId
            + "/"
            + artifactId
            + extensionFor(mediaType);
    URI uploadUrl =
        projectLocalMediaAccess.createUploadUrl(
            storageKey,
            mediaType,
            properties.getMaxArtifactBytes(),
            expiresAt,
            URI.create(properties.getArtifactBaseUrl()));
    OutputArtifactTargetDto target =
        new OutputArtifactTargetDto(
            artifactId,
            role,
            mediaType,
            new ArtifactWriteAccessDto(
                "PUT", uploadUrl.toString(), expiresAt, Map.of("Content-Type", mediaType)));
    outputBindings.put(artifactId, new Binding(target, storageKey));
    return target;
  }

  @Override
  public OutputArtifactTargetDto getOrCreateTarget(
      UUID taskId, UUID attemptId, UUID artifactId, String role, String mediaType) {
    Binding existing = outputBindings.get(artifactId);
    if (existing != null) {
      return existing.target();
    }
    Instant expiresAt = Instant.now().plus(properties.getArtifactTtl());
    String storageKey =
        "private/provider-results/"
            + taskId
            + "/"
            + attemptId
            + "/"
            + artifactId
            + extensionFor(mediaType);
    URI uploadUrl =
        projectLocalMediaAccess.createUploadUrl(
            storageKey,
            mediaType,
            properties.getMaxArtifactBytes(),
            expiresAt,
            URI.create(properties.getArtifactBaseUrl()));
    OutputArtifactTargetDto target =
        new OutputArtifactTargetDto(
            artifactId,
            role,
            mediaType,
            new ArtifactWriteAccessDto(
                "PUT", uploadUrl.toString(), expiresAt, Map.of("Content-Type", mediaType)));
    outputBindings.put(artifactId, new Binding(target, storageKey));
    return target;
  }

  @Override
  public InputArtifactRefDto createInput(UUID projectId, UUID assetId, String role) {
    MediaAssetView asset = mediaAssetRepository.findById(projectId, assetId);
    if (asset.storageKey() == null
        || asset.storageKey().isBlank()
        || !"READY".equals(asset.status())
        || asset.sizeBytes() <= 0
        || asset.sha256() == null
        || !asset.sha256().matches("^[0-9a-f]{64}$")) {
      throw new IllegalArgumentException(
          "Input media asset is not ready or lacks integrity metadata");
    }
    Instant expiresAt = Instant.now().plus(properties.getArtifactTtl());
    URI downloadUrl =
        projectLocalMediaAccess.supports(asset.storageKey())
            ? projectLocalMediaAccess.createDownloadUrl(
                asset.storageKey(), expiresAt, URI.create(properties.getArtifactBaseUrl()))
            : mediaStorageAccess.createDownloadUrl(asset.storageKey(), expiresAt);
    return new InputArtifactRefDto(
        asset.id(),
        role,
        asset.contentType(),
        asset.sizeBytes(),
        asset.sha256().toLowerCase(),
        new ArtifactReadAccessDto("GET", downloadUrl.toString(), expiresAt, Map.of()));
  }

  @Override
  public void verifyOutput(OutputArtifactTargetDto target, ProducedArtifactDto produced) {
    if (target == null || produced == null) {
      throw new IllegalArgumentException("Compute output is missing");
    }
    Binding binding = outputBindings.get(target.artifactId());
    if (binding == null || !binding.target().equals(target)) {
      throw new IllegalArgumentException("Compute output target is not owned by this dispatch");
    }
    if (!target.artifactId().equals(produced.artifactId())
        || !target.role().equals(produced.role())
        || !target.mediaType().equals(produced.mediaType())
        || produced.sizeBytes() <= 0
        || produced.sha256() == null
        || !produced.sha256().matches("^[0-9a-f]{64}$")) {
      throw new IllegalArgumentException("Compute output metadata does not match its target");
    }
    var stored = projectLocalMediaAccess.inspect(binding.storageKey());
    if (stored.sizeBytes() != produced.sizeBytes()
        || !stored.sha256().equalsIgnoreCase(produced.sha256())) {
      throw new IllegalArgumentException(
          "Compute output bytes failed backend integrity verification");
    }
  }

  @Override
  public byte[] readOutput(OutputArtifactTargetDto target) {
    Binding binding = outputBindings.get(target.artifactId());
    if (binding == null || !binding.target().equals(target)) {
      throw new IllegalArgumentException("Compute output target is not owned by this dispatch");
    }
    return projectLocalMediaAccess.readBytes(
        binding.storageKey(), properties.getMaxArtifactBytes());
  }

  @Override
  public String storageKey(OutputArtifactTargetDto target) {
    Binding binding = outputBindings.get(target.artifactId());
    if (binding == null || !binding.target().equals(target)) {
      throw new IllegalArgumentException("Compute output target is not owned by this dispatch");
    }
    return binding.storageKey();
  }

  private static String extensionFor(String mediaType) {
    return switch (mediaType == null ? "" : mediaType.toLowerCase()) {
      case "application/json" -> ".json";
      case "audio/wav" -> ".wav";
      case "audio/mpeg" -> ".mp3";
      case "image/png" -> ".png";
      case "image/jpeg" -> ".jpg";
      case "image/webp" -> ".webp";
      case "video/mp4" -> ".mp4";
      default -> ".bin";
    };
  }

  private record Binding(OutputArtifactTargetDto target, String storageKey) {}
}
