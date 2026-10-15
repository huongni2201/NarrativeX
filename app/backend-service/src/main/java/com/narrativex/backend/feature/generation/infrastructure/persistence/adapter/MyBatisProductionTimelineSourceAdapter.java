package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ProductionTimelineSourceRepository;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProductionTimelineBeatRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProductionTimelineChapterRow;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProductionTimelineMapper;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MyBatisProductionTimelineSourceAdapter implements ProductionTimelineSourceRepository {
  private final ProductionTimelineMapper mapper;

  @Override
  public List<ChapterSource> findChapters(UUID projectId) {
    return mapper.findChapters(projectId, null).stream().map(this::toChapterSource).toList();
  }

  @Override
  public Optional<ChapterSource> findChapter(UUID projectId, UUID chapterId) {
    return mapper.findChapters(projectId, chapterId).stream()
        .map(this::toChapterSource)
        .findFirst();
  }

  @Override
  public List<BeatSource> findBeats(UUID projectId) {
    return mapper.findBeats(projectId, null).stream().map(this::toBeatSource).toList();
  }

  @Override
  public List<BeatSource> findBeats(UUID projectId, UUID chapterId) {
    return mapper.findBeats(projectId, chapterId).stream().map(this::toBeatSource).toList();
  }

  @Override
  public boolean hasNativeShotBeats(UUID projectId) {
    return mapper.hasNativeShotBeats(projectId);
  }

  private ChapterSource toChapterSource(ProductionTimelineChapterRow row) {
    return new ChapterSource(
        row.getStoryVersionId(),
        row.getChapterId(),
        row.getOrderIndex(),
        row.getTitle(),
        row.getRowVersion(),
        row.getSourceHash(),
        row.getMediaPlanId(),
        row.getMediaPlanRevision(),
        row.getAspectRatio(),
        row.getAudioDurationMs(),
        row.getAudioStorageKey(),
        row.getAudioSizeBytes(),
        row.getAudioChecksum(),
        row.getNarrationRequestId(),
        row.getNarrationAssetId(),
        row.getNarrationAlignmentId(),
        row.getSubtitleText(),
        row.getSubtitleWordsJson(),
        row.getFallbackDurationMs(),
        row.getBeatCount(),
        row.getReadyBeatCount());
  }

  private BeatSource toBeatSource(ProductionTimelineBeatRow row) {
    return new BeatSource(
        row.getChapterId(),
        row.getChapterOrderIndex(),
        row.getMediaPlanId(),
        row.getMediaPlanRevision(),
        row.getSceneIndex(),
        row.getBeatIndex(),
        row.getVisualBeatId(),
        row.getShotId(),
        row.getTakeId(),
        row.getTitle(),
        row.getVisualIntent(),
        row.getCameraMovement(),
        row.getAssetStrategy(),
        row.getTextStart(),
        row.getTextEnd(),
        row.getMediaAssetId(),
        row.getMediaType(),
        row.getSourceDurationMs(),
        row.getFitMode(),
        row.getTrimStartMs(),
        row.isMediaSelectionActive(),
        row.getStorageKey(),
        row.getSizeBytes(),
        row.getChecksum(),
        row.getSourceOutMs());
  }
}
