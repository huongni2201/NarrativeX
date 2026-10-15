package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisPromptSnapshot;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisPromptSnapshotRepository;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterAnalysisPromptSnapshotMapper;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisChapterAnalysisPromptSnapshotRepository
    implements ChapterAnalysisPromptSnapshotRepository {
  private final ChapterAnalysisPromptSnapshotMapper mapper;

  @Override
  public void save(ChapterAnalysisPromptSnapshot snapshot) {
    int inserted =
        mapper.insert(
            snapshot.generationJobId(),
            snapshot.settingsRevision(),
            snapshot.instruction(),
            snapshot.instructionHash());
    if (inserted != 1) {
      throw new IllegalStateException("Chapter analysis prompt snapshot was not inserted");
    }
  }

  @Override
  public Optional<ChapterAnalysisPromptSnapshot> find(UUID generationJobId) {
    return Optional.ofNullable(mapper.find(generationJobId))
        .map(
            row ->
                new ChapterAnalysisPromptSnapshot(
                    row.getGenerationJobId(),
                    row.getSettingsRevision(),
                    row.getInstruction(),
                    row.getInstructionHash()));
  }
}
