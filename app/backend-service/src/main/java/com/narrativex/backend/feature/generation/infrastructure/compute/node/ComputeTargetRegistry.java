package com.narrativex.backend.feature.generation.infrastructure.compute.node;

import com.narrativex.backend.feature.generation.infrastructure.compute.ComputeServiceProperties;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class ComputeTargetRegistry {
  public static final String DEFAULT_TARGET_ID = "default-remote-gpu";
  private final Map<String, ComputeTarget> targets = new ConcurrentHashMap<>();
  private final ComputeServiceProperties defaultProperties;

  public ComputeTargetRegistry(ComputeServiceProperties defaultProperties) {
    this.defaultProperties = defaultProperties;
    registerDefaultTarget();
  }

  public void registerDefaultTarget() {
    if (defaultProperties.getBaseUrl() != null && !defaultProperties.getBaseUrl().isBlank()) {
      targets.put(
          DEFAULT_TARGET_ID,
          new ComputeTarget(
              DEFAULT_TARGET_ID,
              "Default Generation Service",
              defaultProperties.getBaseUrl(),
              defaultProperties.getMachineToken(),
              ComputeTargetStatus.ONLINE,
              Set.of("vieneu", "comfyui", "whisperx", "media-validator"),
              Instant.now()));
    }
  }

  public void register(ComputeTarget target) {
    targets.put(target.id(), target);
  }

  public Optional<ComputeTarget> findById(String id) {
    return Optional.ofNullable(targets.get(id));
  }

  public Optional<ComputeTarget> getActiveTarget() {
    return targets.values().stream().filter(ComputeTarget::isReady).findFirst();
  }

  public Optional<ComputeTarget> resolveTargetForExecutor(String executor) {
    return targets.values().stream()
        .filter(
            t ->
                t.isReady()
                    && (t.supportedExecutors().isEmpty()
                        || t.supportedExecutors().contains(executor)))
        .findFirst();
  }

  public void updateStatus(String id, ComputeTargetStatus status) {
    ComputeTarget existing = targets.get(id);
    if (existing != null) {
      targets.put(
          id,
          new ComputeTarget(
              existing.id(),
              existing.name(),
              existing.baseUrl(),
              existing.machineToken(),
              status,
              existing.supportedExecutors(),
              Instant.now()));
    }
  }

  public Map<String, ComputeTarget> getAll() {
    return Map.copyOf(targets);
  }
}
