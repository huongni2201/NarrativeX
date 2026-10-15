package com.narrativex.backend.feature.generation.infrastructure.analysis.local;

import com.narrativex.backend.feature.generation.application.model.analysis.*;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisExecutionStore;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisPromptSnapshotRepository;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisSnapshotCapture;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.ChapterAnalysisExecutionMode;
import com.narrativex.backend.feature.generation.infrastructure.analysis.ChapterAnalysisContractResources;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class LocalAnalysisSnapshotCapture implements ChapterAnalysisSnapshotCapture {
  private final ChapterAnalysisExecutionStore store;
  private final ChapterAnalysisContractResources resources;
  private final ChapterAnalysisPromptSnapshotRepository promptSnapshots;

  public LocalAnalysisSnapshotCapture(
      ChapterAnalysisExecutionStore store,
      ChapterAnalysisPromptSnapshotRepository promptSnapshots,
      ObjectMapper json) {
    this.store = store;
    this.promptSnapshots = promptSnapshots;
    this.resources = new ChapterAnalysisContractResources(json);
  }

  @Override
  public void capture(GenerationJob job) {
    var config = store.findRuntimeConfiguration();
    // The instruction frozen in this admission transaction by EnqueueStoryAnalysisUseCase.
    String customInstruction =
        promptSnapshots
            .find(job.getId())
            .map(ChapterAnalysisPromptSnapshot::instruction)
            .orElse("");
    long inputBytes =
        job.getSourceText().getBytes(StandardCharsets.UTF_8).length
            + customInstruction.getBytes(StandardCharsets.UTF_8).length;
    if (inputBytes > config.maxInputBytes()) {
      throw new IllegalArgumentException(
          "INPUT_TOO_LARGE: Chapter and prompt instruction exceed the local analysis byte limit");
    }
    var profile =
        new ChapterAnalysisExecutionProfile(
            ChapterAnalysisExecutionMode.ANTIGRAVITY_CLI,
            config.model(),
            config.effort(),
            "1.1",
            resources.promptHash(),
            "1.1",
            resources.schemaHash());
    String fingerprint =
        CanonHashCalculator.sha256(
            job.getSourceHash()
                + ":"
                + job.getSourceLanguage()
                + ":"
                + profile
                + ":"
                + job.getStoryboardRevisionId()
                + ":"
                + CanonHashCalculator.sha256(customInstruction));
    store.saveSnapshot(
        new ChapterAnalysisExecutionSnapshot(
            job.getId(),
            profile,
            ChapterAnalysisInstructions.compose(
                resources.systemInstruction("1.1", "1.1"), customInstruction),
            resources.responseSchema(),
            fingerprint,
            config.revision(),
            null));
  }
}
