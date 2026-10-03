package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.api.response.RuntimeCapabilityView;
import com.narrativex.backend.feature.generation.application.model.VideoRuntimeCapability;
import com.narrativex.backend.feature.generation.application.model.VideoRuntimeCapability.ResolutionProfile;
import com.narrativex.backend.feature.generation.application.port.out.VideoGenerationCatalog;
import com.narrativex.backend.feature.generation.application.query.RuntimeCapabilityQuery;
import com.narrativex.backend.feature.generation.application.model.compute.WorkerCapabilitiesDto;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class RuntimeCapabilityService {
  private final VideoGenerationCatalog catalog;
  private final GenerationExecutionPort executionPort;

  public RuntimeCapabilityView query(RuntimeCapabilityQuery query) {
    Optional<WorkerCapabilitiesDto> workerCaps = Optional.empty();
    try {
      if (executionPort != null) {
        workerCaps = executionPort.fetchCapabilities();
      }
    } catch (Exception e) {
      log.warn("Failed to probe worker capabilities: {}", e.getMessage());
    }

    if (workerCaps.isEmpty()) {
      return new RuntimeCapabilityView(
          new VideoRuntimeCapability(
              false,
              "OFFLINE",
              catalog.defaultProvider(),
              catalog.defaultModel(),
              catalog.defaultProfile(),
              List.of(),
              List.of(),
              List.of(new ResolutionProfile(1280, 720, 24)),
              List.of(),
              "Worker service is offline or unreachable"));
    }

    var executors = workerCaps.get().executors();
    var ltxExecutor =
        executors != null
            ? executors.stream()
                .filter(e -> catalog.defaultProvider().equalsIgnoreCase(e.name()))
                .findFirst()
            : Optional.<WorkerCapabilitiesDto.ExecutorCapabilityDto>empty();

    if (ltxExecutor.isEmpty()) {
      return new RuntimeCapabilityView(
          new VideoRuntimeCapability(
              false,
              "UNAVAILABLE",
              catalog.defaultProvider(),
              catalog.defaultModel(),
              catalog.defaultProfile(),
              List.of(),
              List.of(),
              List.of(new ResolutionProfile(1280, 720, 24)),
              List.of(),
              "Executor " + catalog.defaultProvider() + " is not advertised by worker"));
    }

    var executor = ltxExecutor.get();
    if (!executor.ready()) {
      return new RuntimeCapabilityView(
          new VideoRuntimeCapability(
              false,
              "DEGRADED",
              catalog.defaultProvider(),
              catalog.defaultModel(),
              catalog.defaultProfile(),
              List.of(),
              List.of(),
              List.of(new ResolutionProfile(1280, 720, 24)),
              List.of(),
              "Executor runtime preflight check has not passed"));
    }

    boolean modelSupported =
        executor.models() != null
            && executor.models().stream()
                .anyMatch(
                    m ->
                        catalog.defaultModel().equalsIgnoreCase(m.model())
                            && catalog.modelRevision().equalsIgnoreCase(m.revision()));

    if (!modelSupported) {
      return new RuntimeCapabilityView(
          new VideoRuntimeCapability(
              false,
              "DEGRADED",
              catalog.defaultProvider(),
              catalog.defaultModel(),
              catalog.defaultProfile(),
              List.of(),
              List.of(),
              List.of(new ResolutionProfile(1280, 720, 24)),
              List.of(),
              "Pinned model revision "
                  + catalog.defaultModel()
                  + ":"
                  + catalog.modelRevision()
                  + " not loaded"));
    }

    var strategies =
        catalog.supportedStrategies().stream()
            .map(Enum::name)
            .toList();

    return new RuntimeCapabilityView(
        new VideoRuntimeCapability(
            true,
            "READY",
            catalog.defaultProvider(),
            catalog.defaultModel(),
            catalog.defaultProfile(),
            strategies,
            catalog.supportedAspectRatios(),
            List.of(new ResolutionProfile(1280, 720, 24)),
            List.of("LTX_NATIVE_AV"),
            null));
  }
}
