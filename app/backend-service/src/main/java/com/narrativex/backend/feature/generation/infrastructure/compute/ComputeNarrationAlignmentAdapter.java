package com.narrativex.backend.feature.generation.infrastructure.compute;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.compute.CanonicalFingerprintCalculator;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.InputArtifactRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.ModelRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.OutputArtifactTargetDto;
import com.narrativex.backend.feature.generation.application.model.compute.ProducedArtifactDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskArtifactsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskConstraintsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskDescriptorDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeArtifactAccess;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.application.port.out.NarrationAlignmentProvider;
import com.narrativex.backend.feature.generation.domain.enums.AlignmentStatus;
import com.narrativex.backend.feature.generation.domain.value.NarrationDocument;
import com.narrativex.backend.feature.generation.domain.value.NarrationDocumentChapter;
import com.narrativex.backend.feature.generation.domain.value.NarrationPartSnapshot;
import com.narrativex.backend.feature.generation.domain.value.NarrationPartTimeline;
import com.narrativex.backend.feature.generation.domain.value.NarrationSetSnapshot;
import com.narrativex.backend.feature.generation.domain.value.NarrationSpan;
import com.narrativex.backend.feature.generation.domain.value.NarrationTimeline;
import com.narrativex.backend.feature.generation.domain.value.WordAlignment;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Slf4j
@Component
public class ComputeNarrationAlignmentAdapter implements NarrationAlignmentProvider {
  private static final String PROTOCOL_VERSION = "1.0";
  private static final String TASK_TYPE = "audio.align";
  private static final String EXECUTOR = "whisperx";
  private static final String MODEL = "large-v3";
  private static final String REVISION = "3.8.6";
  private static final JsonMapper JSON = JsonMapper.builder().build();

  private final GenerationExecutionPort executionPort;
  private final ComputeArtifactAccess artifactAccess;

  public ComputeNarrationAlignmentAdapter(
      GenerationExecutionPort executionPort, ComputeArtifactAccess artifactAccess) {
    this.executionPort = executionPort;
    this.artifactAccess = artifactAccess;
  }

  @Override
  public NarrationTimeline align(NarrationDocument document, NarrationSetSnapshot narration) {
    if (narration.parts().size() != 1) {
      log.warn("WhisperX alignment requires one canonical narration audio artifact");
      return failedTimeline(document, narration);
    }
    String script;
    try {
      script = document.requireSourceText();
    } catch (RuntimeException exception) {
      log.warn("Narration document has no source text for WhisperX alignment", exception);
      return failedTimeline(document, narration);
    }

    UUID taskId = UuidV7.random();
    UUID attemptId = UuidV7.random();
    String idempotencyKey = "align:" + document.id() + ":" + narration.narrationSetId();
    TaskDescriptorDto task = new TaskDescriptorDto(TASK_TYPE, "1.0");
    ModelRefDto model = new ModelRefDto(EXECUTOR, MODEL, REVISION);
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.now().plus(15, ChronoUnit.MINUTES), 900);
    InputArtifactRefDto input;
    OutputArtifactTargetDto output;
    try {
      input =
          artifactAccess.createInput(
              document.storyId(), narration.parts().getFirst().mediaAssetId(), "source-audio");
      output = artifactAccess.createOutput(taskId, attemptId, "alignment", "application/json");
    } catch (RuntimeException exception) {
      log.warn("WhisperX artifact capability creation failed", exception);
      return failedTimeline(document, narration);
    }
    Map<String, Object> inputs =
        Map.of("script", script, "language", "vi", "audioArtifactRole", "source-audio");
    TaskArtifactsDto artifacts = new TaskArtifactsDto(List.of(input), List.of(output));
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
      ComputeObservationDto observation =
          new ComputeObservationReconciler(
                  executionPort, java.time.Duration.ofSeconds(30), java.time.Duration.ofMillis(250))
              .reconcile(taskId, attemptId);
      ProducedArtifactDto produced = requireProducedOutput(observation, output);
      artifactAccess.verifyOutput(output, produced);
      List<WordAlignment> words =
          parseWords(artifactAccess.readOutput(output), narration.totalDurationMs());
      return buildTimeline(document, narration, words);
    } catch (RuntimeException exception) {
      log.warn("Compute service alignment failed; alignment remains non-ready", exception);
      return failedTimeline(document, narration);
    }
  }

  private static ProducedArtifactDto requireProducedOutput(
      ComputeObservationDto observation, OutputArtifactTargetDto target) {
    if (observation == null || !observation.isSucceeded()) {
      throw new IllegalArgumentException("WhisperX did not produce a successful observation");
    }
    return observation.outputs().stream()
        .filter(
            artifact ->
                artifact != null
                    && target.artifactId().equals(artifact.artifactId())
                    && target.role().equals(artifact.role())
                    && target.mediaType().equals(artifact.mediaType()))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("WhisperX alignment artifact is missing"));
  }

  private static List<WordAlignment> parseWords(byte[] payload, long durationMs) {
    if (payload == null || payload.length == 0) {
      throw new IllegalArgumentException("alignment output is empty");
    }
    try {
      JsonNode root = JSON.readTree(new String(payload, StandardCharsets.UTF_8));
      if (!root.isArray() || root.isEmpty()) {
        throw new IllegalArgumentException("alignment words are missing");
      }
      List<WordAlignment> result = new ArrayList<>();
      int expectedIndex = 0;
      int previousTextEnd = 0;
      long previousAudioEnd = 0;
      for (JsonNode node : root) {
        if (!node.isObject()
            || !node.hasNonNull("index")
            || !node.hasNonNull("textStart")
            || !node.hasNonNull("textEnd")
            || !node.hasNonNull("audioStartMs")
            || !node.hasNonNull("audioEndMs")
            || !node.hasNonNull("confidence")) {
          throw new IllegalArgumentException("alignment word fields are incomplete");
        }
        int index = node.get("index").asInt();
        int textStart = node.get("textStart").asInt();
        int textEnd = node.get("textEnd").asInt();
        long audioStart = node.get("audioStartMs").asLong();
        long audioEnd = node.get("audioEndMs").asLong();
        double confidence = node.get("confidence").asDouble();
        if (index != expectedIndex
            || textStart < previousTextEnd
            || audioStart < previousAudioEnd
            || audioEnd > durationMs) {
          throw new IllegalArgumentException("alignment words are not monotonic");
        }
        result.add(new WordAlignment(index, textStart, textEnd, audioStart, audioEnd, confidence));
        previousTextEnd = textEnd;
        previousAudioEnd = audioEnd;
        expectedIndex++;
      }
      return List.copyOf(result);
    } catch (RuntimeException exception) {
      if (exception instanceof IllegalArgumentException) throw exception;
      throw new IllegalArgumentException("alignment output is invalid", exception);
    }
  }

  private static NarrationTimeline buildTimeline(
      NarrationDocument document, NarrationSetSnapshot narration, List<WordAlignment> words) {
    List<NarrationSpan> spans = new ArrayList<>();
    for (NarrationDocumentChapter chapter : document.chapters()) {
      List<WordAlignment> chapterWords =
          words.stream()
              .filter(
                  word ->
                      word.textEnd() > chapter.globalTextStart()
                          && word.textStart() < chapter.globalTextEnd())
              .toList();
      if (chapterWords.isEmpty()) {
        throw new IllegalArgumentException("chapter has no aligned words");
      }
      WordAlignment first = chapterWords.getFirst();
      WordAlignment last = chapterWords.getLast();
      double confidence =
          chapterWords.stream().mapToDouble(WordAlignment::confidence).average().orElse(0.0);
      spans.add(
          new NarrationSpan(
              chapter.chapterRevisionId(),
              Math.max(0, first.textStart() - chapter.globalTextStart()),
              Math.min(
                  chapter.globalTextEnd() - chapter.globalTextStart(),
                  last.textEnd() - chapter.globalTextStart()),
              chapter.globalTextStart(),
              chapter.globalTextEnd(),
              first.audioStartMs(),
              last.audioEndMs(),
              confidence));
    }
    double confidence = words.stream().mapToDouble(WordAlignment::confidence).average().orElse(0.0);
    return new NarrationTimeline(
        document.id(),
        narration.narrationSetId(),
        document.documentFingerprint(),
        narration.narrationFingerprint(),
        narration.totalDurationMs(),
        partTimelines(narration),
        spans,
        1.0,
        confidence,
        AlignmentStatus.READY);
  }

  private static List<NarrationPartTimeline> partTimelines(NarrationSetSnapshot narration) {
    List<NarrationPartTimeline> result = new ArrayList<>();
    long cursor = 0L;
    for (NarrationPartSnapshot part : narration.parts()) {
      result.add(
          new NarrationPartTimeline(
              part.mediaAssetId(),
              part.sequence(),
              cursor,
              cursor + part.durationMs(),
              part.durationMs()));
      cursor += part.durationMs();
    }
    return List.copyOf(result);
  }

  private static NarrationTimeline failedTimeline(
      NarrationDocument document, NarrationSetSnapshot narration) {
    long duration = narration.totalDurationMs();
    if (duration <= 0) duration = 1;
    return new NarrationTimeline(
        document.id(),
        narration.narrationSetId(),
        document.documentFingerprint(),
        narration.narrationFingerprint(),
        duration,
        partTimelines(narration),
        List.of(),
        0.0,
        0.0,
        AlignmentStatus.FAILED);
  }
}
