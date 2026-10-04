package com.narrativex.backend.feature.generation.application.model.compute;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record WorkerCapabilitiesDto(
    List<String> protocolVersions,
    String workerVersion,
    List<ExecutorCapabilityDto> executors,
    Map<String, Object> limits) {

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ExecutorCapabilityDto(
      String name,
      List<String> taskTypes,
      List<ModelRefDto> models,
      boolean ready,
      Map<String, List<String>> taskSchemaVersions,
      List<WorkflowProfileCapabilityDto> workflowProfiles) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record WorkflowProfileCapabilityDto(
      String profileId,
      boolean nativeAudio,
      boolean voiceConditioning,
      boolean voiceDescription,
      boolean t2v,
      boolean i2v,
      boolean firstLastFrame) {}
}
