package com.narrativex.backend.feature.generation.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.application.model.compute.ModelRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.WorkerCapabilitiesDto;
import com.narrativex.backend.feature.generation.application.model.compute.WorkerCapabilitiesDto.WorkflowProfileCapabilityDto;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.VideoGenerationCatalog;
import com.narrativex.backend.feature.generation.application.query.RuntimeCapabilityQuery;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RuntimeCapabilityServiceTest {
  private VideoGenerationCatalog catalog;
  private GenerationExecutionPort executionPort;
  private RuntimeCapabilityService service;

  @BeforeEach
  void setUp() {
    catalog = mock(VideoGenerationCatalog.class);
    when(catalog.defaultProvider()).thenReturn("ltx");
    when(catalog.defaultModel()).thenReturn("ltx-2.5-22b-distilled-int8");
    when(catalog.modelRevision()).thenReturn("5e6e71018ee1756ed329b697a7b4aedc934dfce9");
    when(catalog.defaultProfile()).thenReturn("ltx-2.5-22b-distilled-int8-native-av-v1");
    when(catalog.taskSchemaVersion()).thenReturn("1.1");
    when(catalog.supportedStrategies()).thenReturn(List.of(GenerationStrategy.TEXT_TO_VIDEO));
    when(catalog.supportedAspectRatios()).thenReturn(List.of("16:9"));

    executionPort = mock(GenerationExecutionPort.class);
    service = new RuntimeCapabilityService(catalog, executionPort);
  }

  @Test
  void workerOfflineFailsClosedWithOfflineStatus() {
    when(executionPort.fetchCapabilities()).thenReturn(Optional.empty());

    var view = service.query(new RuntimeCapabilityQuery());
    var cap = view.videoGeneration();

    assertFalse(cap.available());
    assertEquals("OFFLINE", cap.status());
    assertTrue(cap.strategies().isEmpty());
    assertTrue(cap.supportedAspectRatios().isEmpty());
  }

  @Test
  void missingLtxExecutorFailsClosedWithUnavailableStatus() {
    var workerCaps =
        new WorkerCapabilitiesDto(
            List.of("1.0"),
            "0.1.0",
            List.of(
                new WorkerCapabilitiesDto.ExecutorCapabilityDto(
                    "vieneu", List.of("audio.synthesize"), List.of(), true, Map.of(), List.of())),
            Map.of());
    when(executionPort.fetchCapabilities()).thenReturn(Optional.of(workerCaps));

    var view = service.query(new RuntimeCapabilityQuery());
    var cap = view.videoGeneration();

    assertFalse(cap.available());
    assertEquals("UNAVAILABLE", cap.status());
    assertTrue(cap.strategies().isEmpty());
  }

  @Test
  void unreadyExecutorFailsClosedWithDegradedStatus() {
    var workerCaps =
        new WorkerCapabilitiesDto(
            List.of("1.0"),
            "0.1.0",
            List.of(
                new WorkerCapabilitiesDto.ExecutorCapabilityDto(
                    "ltx",
                    List.of("video.generate"),
                    List.of(
                        new ModelRefDto(
                            "ltx",
                            "ltx-2.5-22b-distilled-int8",
                            "5e6e71018ee1756ed329b697a7b4aedc934dfce9")),
                    false, // NOT ready
                    Map.of(),
                    List.of())),
            Map.of());
    when(executionPort.fetchCapabilities()).thenReturn(Optional.of(workerCaps));

    var view = service.query(new RuntimeCapabilityQuery());
    var cap = view.videoGeneration();

    assertFalse(cap.available());
    assertEquals("DEGRADED", cap.status());
    assertTrue(cap.strategies().isEmpty());
  }

  @Test
  void mismatchedModelRevisionFailsClosedWithDegradedStatus() {
    var workerCaps =
        new WorkerCapabilitiesDto(
            List.of("1.0"),
            "0.1.0",
            List.of(
                new WorkerCapabilitiesDto.ExecutorCapabilityDto(
                    "ltx",
                    List.of("video.generate"),
                    List.of(
                        new ModelRefDto(
                            "ltx",
                            "ltx-2.5-nvfp4",
                            "5e6e71018ee1756ed329b697a7b4aedc934dfce9")), // Wrong model
                    true,
                    Map.of(),
                    List.of())),
            Map.of());
    when(executionPort.fetchCapabilities()).thenReturn(Optional.of(workerCaps));

    var view = service.query(new RuntimeCapabilityQuery());
    var cap = view.videoGeneration();

    assertFalse(cap.available());
    assertEquals("DEGRADED", cap.status());
    assertTrue(cap.strategies().isEmpty());
  }

  @Test
  void mismatchedRevisionFailsClosedWithDegradedStatus() {
    when(executionPort.fetchCapabilities())
        .thenReturn(
            Optional.of(
                worker(
                    executor(
                        true,
                        List.of("video.generate"),
                        List.of(model("ltx-2.5-22b-distilled-int8", "1.0")),
                        Map.of("video.generate", List.of("1.1")),
                        List.of(profile(true, true))))));

    assertUnavailable("DEGRADED");
  }

  @Test
  void missingVideoGenerateTaskTypeFailsClosed() {
    when(executionPort.fetchCapabilities())
        .thenReturn(
            Optional.of(
                worker(
                    executor(
                        true,
                        List.of("audio.synthesize"),
                        configuredModel(),
                        Map.of("video.generate", List.of("1.1")),
                        List.of(profile(true, true))))));

    assertUnavailable("DEGRADED");
  }

  @Test
  void missingSchema11FailsClosed() {
    when(executionPort.fetchCapabilities())
        .thenReturn(
            Optional.of(
                worker(
                    executor(
                        true,
                        List.of("video.generate"),
                        configuredModel(),
                        Map.of("video.generate", List.of("1.0")),
                        List.of(profile(true, true))))));

    assertUnavailable("DEGRADED");
  }

  @Test
  void missingWorkflowProfileFailsClosed() {
    when(executionPort.fetchCapabilities())
        .thenReturn(
            Optional.of(
                worker(
                    executor(
                        true,
                        List.of("video.generate"),
                        configuredModel(),
                        Map.of("video.generate", List.of("1.1")),
                        List.of()))));

    assertUnavailable("DEGRADED");
  }

  @Test
  void workflowProfileWithoutT2vFailsClosed() {
    when(executionPort.fetchCapabilities())
        .thenReturn(
            Optional.of(
                worker(
                    executor(
                        true,
                        List.of("video.generate"),
                        configuredModel(),
                        Map.of("video.generate", List.of("1.1")),
                        List.of(profile(false, true))))));

    assertUnavailable("DEGRADED");
  }

  @Test
  void workflowProfileWithoutNativeAudioFailsClosed() {
    when(executionPort.fetchCapabilities())
        .thenReturn(
            Optional.of(
                worker(
                    executor(
                        true,
                        List.of("video.generate"),
                        configuredModel(),
                        Map.of("video.generate", List.of("1.1")),
                        List.of(profile(true, false))))));

    assertUnavailable("DEGRADED");
  }

  @Test
  void exactLtxWorkflowReturnsOnlyAdvertisedCapabilities() {
    when(executionPort.fetchCapabilities())
        .thenReturn(
            Optional.of(
                worker(
                    executor(
                        true,
                        List.of("video.generate"),
                        configuredModel(),
                        Map.of("video.generate", List.of("1.1")),
                        List.of(profile(true, true))))));

    var cap = service.query(new RuntimeCapabilityQuery()).videoGeneration();

    assertTrue(cap.available());
    assertEquals("READY", cap.status());
    assertEquals("ltx-2.5-22b-distilled-int8-native-av-v1", cap.profile());
    assertEquals(List.of("TEXT_TO_VIDEO"), cap.strategies());
    assertEquals(List.of("16:9"), cap.supportedAspectRatios());
    assertEquals(List.of("LTX_NATIVE_AV"), cap.audioModes());
  }

  private void assertUnavailable(String expectedStatus) {
    var cap = service.query(new RuntimeCapabilityQuery()).videoGeneration();
    assertFalse(cap.available());
    assertEquals(expectedStatus, cap.status());
    assertTrue(cap.strategies().isEmpty());
    assertTrue(cap.audioModes().isEmpty());
  }

  private static WorkerCapabilitiesDto worker(
      WorkerCapabilitiesDto.ExecutorCapabilityDto executor) {
    return new WorkerCapabilitiesDto(List.of("1.0"), "0.1.0", List.of(executor), Map.of());
  }

  private static WorkerCapabilitiesDto.ExecutorCapabilityDto executor(
      boolean ready,
      List<String> taskTypes,
      List<ModelRefDto> models,
      Map<String, List<String>> schemaVersions,
      List<WorkflowProfileCapabilityDto> profiles) {
    return new WorkerCapabilitiesDto.ExecutorCapabilityDto(
        "ltx", taskTypes, models, ready, schemaVersions, profiles);
  }

  private static List<ModelRefDto> configuredModel() {
    return List.of(model("ltx-2.5-22b-distilled-int8", "5e6e71018ee1756ed329b697a7b4aedc934dfce9"));
  }

  private static ModelRefDto model(String name, String revision) {
    return new ModelRefDto("ltx", name, revision);
  }

  private static WorkflowProfileCapabilityDto profile(boolean t2v, boolean nativeAudio) {
    return new WorkflowProfileCapabilityDto(
        "ltx-2.5-22b-distilled-int8-native-av-v1", nativeAudio, false, true, t2v, false, false);
  }
}
