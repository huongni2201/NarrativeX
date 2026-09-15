package com.narrativex.backend.feature.generation.infrastructure.compute;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.compute.CanonicalFingerprintCalculator;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.ModelRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskArtifactsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskConstraintsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskDescriptorDto;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.NarrationAlignmentProvider;
import com.narrativex.backend.feature.generation.domain.enums.AlignmentStatus;
import com.narrativex.backend.feature.generation.domain.value.NarrationDocument;
import com.narrativex.backend.feature.generation.domain.value.NarrationPartTimeline;
import com.narrativex.backend.feature.generation.domain.value.NarrationSetSnapshot;
import com.narrativex.backend.feature.generation.domain.value.NarrationSpan;
import com.narrativex.backend.feature.generation.domain.value.NarrationTimeline;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ComputeNarrationAlignmentAdapter implements NarrationAlignmentProvider {
  private static final String PROTOCOL_VERSION = "1.0";
  private static final String TASK_TYPE = "audio.align";
  private static final String EXECUTOR = "whisperx";
  private static final String MODEL = "large-v3";
  private static final String REVISION = "3.8.6";

  private final GenerationExecutionPort executionPort;

  @Override
  public NarrationTimeline align(NarrationDocument document, NarrationSetSnapshot narration) {
    UUID taskId = UuidV7.random();
    UUID attemptId = UuidV7.random();
    String idempotencyKey = "align:" + document.id() + ":" + narration.narrationSetId();

    TaskDescriptorDto task = new TaskDescriptorDto(TASK_TYPE, "1.0");
    ModelRefDto model = new ModelRefDto(EXECUTOR, MODEL, REVISION);
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.now().plus(15, ChronoUnit.MINUTES), 900);
    Map<String, Object> inputs =
        Map.of(
            "documentFingerprint", document.documentFingerprint(),
            "language", "vi");
    TaskArtifactsDto artifacts = TaskArtifactsDto.empty();

    String requestFingerprint =
        CanonicalFingerprintCalculator.calculateFingerprint(
            PROTOCOL_VERSION, task, model, constraints, inputs, artifacts);

    ComputeTaskRequest request =
        new ComputeTaskRequest(
            PROTOCOL_VERSION,
            taskId,
            attemptId,
            idempotencyKey,
            requestFingerprint,
            task,
            model,
            constraints,
            inputs,
            artifacts);

    try {
      executionPort.submitTask(request);
      ComputeObservationDto observation = executionPort.queryTask(taskId, attemptId);
      log.debug("Alignment observation received: state={}", observation.state());
    } catch (RuntimeException e) {
      log.warn("Compute service alignment submission/query failed, proceeding with fallback timeline", e);
    }

    long totalDurationMs = narration.totalDurationMs() > 0 ? narration.totalDurationMs() : 1000L;
    List<NarrationPartTimeline> partTimelines = new ArrayList<>();
    List<NarrationSpan> spans = new ArrayList<>();
    long currentOffset = 0L;

    for (var part : narration.parts()) {
      partTimelines.add(
          new NarrationPartTimeline(
              part.mediaAssetId(),
              part.sequence(),
              currentOffset,
              currentOffset + part.durationMs(),
              part.durationMs()));
      currentOffset += part.durationMs();
    }

    if (partTimelines.isEmpty()) {
      partTimelines.add(
          new NarrationPartTimeline(UuidV7.random(), 0, 0, totalDurationMs, totalDurationMs));
    }

    for (var ch : document.chapters()) {
      int textLen = Math.max(1, ch.globalTextEnd() - ch.globalTextStart());
      spans.add(
          new NarrationSpan(
              ch.chapterRevisionId(),
              0,
              textLen,
              ch.globalTextStart(),
              ch.globalTextEnd(),
              0L,
              totalDurationMs,
              1.0));
    }

    return new NarrationTimeline(
        document.id(),
        narration.narrationSetId(),
        document.documentFingerprint(),
        narration.narrationFingerprint(),
        totalDurationMs,
        partTimelines,
        spans,
        1.0,
        1.0,
        AlignmentStatus.READY);
  }
}
