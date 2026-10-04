package com.narrativex.backend.feature.generation.application.service;

import com.narrativex.backend.feature.generation.api.response.RuntimeCapabilityView;
import com.narrativex.backend.feature.generation.application.model.VideoRuntimeCapability;
import com.narrativex.backend.feature.generation.application.model.VideoRuntimeCapability.ResolutionProfile;
import com.narrativex.backend.feature.generation.application.model.compute.WorkerCapabilitiesDto;
import com.narrativex.backend.feature.generation.application.model.compute.WorkerCapabilitiesDto.ExecutorCapabilityDto;
import com.narrativex.backend.feature.generation.application.model.compute.WorkerCapabilitiesDto.WorkflowProfileCapabilityDto;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.VideoGenerationCatalog;
import com.narrativex.backend.feature.generation.application.query.RuntimeCapabilityQuery;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class RuntimeCapabilityService {
  private static final String VIDEO_TASK_TYPE = "video.generate";
  private static final String LTX_NATIVE_AV = "LTX_NATIVE_AV";

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
      return unavailable("OFFLINE", null, "Worker service is offline or unreachable");
    }

    var executors = workerCaps.get().executors();
    var ltxExecutor =
        executors != null
            ? executors.stream()
                .filter(e -> e != null && catalog.defaultProvider().equalsIgnoreCase(e.name()))
                .findFirst()
            : Optional.<ExecutorCapabilityDto>empty();

    if (ltxExecutor.isEmpty()) {
      return unavailable(
          "UNAVAILABLE",
          null,
          "Executor " + catalog.defaultProvider() + " is not advertised by worker");
    }

    var executor = ltxExecutor.get();
    if (!executor.ready()) {
      return unavailable("DEGRADED", null, "Executor runtime preflight check has not passed");
    }

    if (executor.taskTypes() == null || !executor.taskTypes().contains(VIDEO_TASK_TYPE)) {
      return unavailable(
          "DEGRADED", null, "Executor does not advertise task type " + VIDEO_TASK_TYPE);
    }

    boolean modelSupported =
        executor.models() != null
            && executor.models().stream()
                .anyMatch(
                    model ->
                        model != null
                            && catalog.defaultModel().equals(model.model())
                            && catalog.modelRevision().equals(model.revision()));

    if (!modelSupported) {
      return unavailable(
          "DEGRADED",
          null,
          "Pinned model revision "
              + catalog.defaultModel()
              + ":"
              + catalog.modelRevision()
              + " not loaded");
    }

    var schemaVersions = executor.taskSchemaVersions();
    if (schemaVersions == null
        || schemaVersions.get(VIDEO_TASK_TYPE) == null
        || !schemaVersions.get(VIDEO_TASK_TYPE).contains(catalog.taskSchemaVersion())) {
      return unavailable(
          "DEGRADED",
          null,
          VIDEO_TASK_TYPE + " schema " + catalog.taskSchemaVersion() + " is not advertised");
    }

    WorkflowProfileCapabilityDto profile = findProfile(executor).orElse(null);
    if (profile == null) {
      return unavailable(
          "DEGRADED", null, "Workflow profile " + catalog.defaultProfile() + " is not advertised");
    }
    if (!profile.t2v()) {
      return unavailable(
          "DEGRADED", profile.profileId(), "Workflow profile does not support text-to-video");
    }
    if (!profile.nativeAudio()) {
      return unavailable(
          "DEGRADED", profile.profileId(), "Workflow profile does not support native audio");
    }

    List<String> strategies = new ArrayList<>();
    strategies.add("TEXT_TO_VIDEO");
    if (profile.i2v()) strategies.add("IMAGE_TO_VIDEO");
    if (profile.firstLastFrame()) strategies.add("FIRST_LAST_FRAME");

    return new RuntimeCapabilityView(
        new VideoRuntimeCapability(
            true,
            "READY",
            catalog.defaultProvider(),
            catalog.defaultModel(),
            profile.profileId(),
            strategies,
            catalog.supportedAspectRatios(),
            List.of(new ResolutionProfile(1280, 720, 24)),
            List.of(LTX_NATIVE_AV),
            null));
  }

  private Optional<WorkflowProfileCapabilityDto> findProfile(ExecutorCapabilityDto executor) {
    return executor.workflowProfiles() == null
        ? Optional.empty()
        : executor.workflowProfiles().stream()
            .filter(
                profile -> profile != null && catalog.defaultProfile().equals(profile.profileId()))
            .findFirst();
  }

  private RuntimeCapabilityView unavailable(String status, String profile, String reason) {
    return new RuntimeCapabilityView(
        new VideoRuntimeCapability(
            false,
            status,
            catalog.defaultProvider(),
            catalog.defaultModel(),
            profile,
            List.of(),
            List.of(),
            List.of(new ResolutionProfile(1280, 720, 24)),
            List.of(),
            reason));
  }
}
