package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisRunRepository;
import com.narrativex.backend.feature.generation.domain.entity.ChapterAnalysisRun;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterAnalysisRunMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterAnalysisRunRow;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisChapterAnalysisRunRepository implements ChapterAnalysisRunRepository {
  private final ChapterAnalysisRunMapper mapper;

  @Override
  public ChapterAnalysisRun recordRun(ChapterAnalysisRun run) {
    Objects.requireNonNull(run, "run must not be null");
    UUID id = run.id() != null ? run.id() : UUID.randomUUID();
    ChapterAnalysisRunRow row =
        ChapterAnalysisRunRow.builder()
            .id(id)
            .generationJobId(run.generationJobId())
            .chapterId(run.chapterId())
            .storyboardRevisionId(run.storyboardRevisionId())
            .sourceHash(run.sourceHash())
            .model(run.model())
            .promptVersion(run.promptVersion())
            .schemaVersion(run.schemaVersion())
            .promptTokens(run.promptTokens())
            .outputTokens(run.outputTokens())
            .thinkingTokens(run.thinkingTokens())
            .cachedTokens(run.cachedTokens())
            .totalTokens(run.totalTokens())
            .runtimeMs(run.runtimeMs())
            .canonHash(run.canonHash())
            .createdAt(run.createdAt())
            .build();

    mapper.insert(row);
    ChapterAnalysisRunRow saved = mapper.findById(id);
    if (saved == null) {
      throw new IllegalStateException("Failed to retrieve persisted analysis run: " + id);
    }
    return toDomain(saved);
  }

  @Override
  public Optional<ChapterAnalysisRun> findLatestByChapterId(UUID chapterId) {
    Objects.requireNonNull(chapterId, "chapterId must not be null");
    ChapterAnalysisRunRow row = mapper.findLatestByChapterId(chapterId);
    return Optional.ofNullable(row).map(this::toDomain);
  }

  @Override
  public List<ChapterAnalysisRun> findByChapterId(UUID chapterId) {
    Objects.requireNonNull(chapterId, "chapterId must not be null");
    return mapper.findByChapterId(chapterId).stream().map(this::toDomain).toList();
  }

  @Override
  public Optional<ChapterAnalysisRun> findByJobId(UUID generationJobId) {
    Objects.requireNonNull(generationJobId, "generationJobId must not be null");
    ChapterAnalysisRunRow row = mapper.findByJobId(generationJobId);
    return Optional.ofNullable(row).map(this::toDomain);
  }

  private ChapterAnalysisRun toDomain(ChapterAnalysisRunRow row) {
    return new ChapterAnalysisRun(
        row.getId(),
        row.getGenerationJobId(),
        row.getChapterId(),
        row.getStoryboardRevisionId(),
        row.getSourceHash(),
        row.getModel(),
        row.getPromptVersion(),
        row.getSchemaVersion(),
        row.getPromptTokens(),
        row.getOutputTokens(),
        row.getThinkingTokens(),
        row.getCachedTokens(),
        row.getTotalTokens(),
        row.getRuntimeMs(),
        row.getCanonHash(),
        row.getCreatedAt());
  }
}
