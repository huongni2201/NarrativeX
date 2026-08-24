package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ProductionTimelineSourceRepository;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProductionTimelineMapper;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class MyBatisProductionTimelineSourceAdapter implements ProductionTimelineSourceRepository {
  private final ProductionTimelineMapper mapper;

  @Override
  public List<ChapterSource> findChapters(UUID projectId, String ownerId) {
    return mapper.findChapters(projectId, ownerId).stream()
        .map(
            row ->
                new ChapterSource(
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
                    row.getFallbackDurationMs(),
                    row.getBeatCount(),
                    row.getReadyBeatCount()))
        .toList();
  }

  @Override
  public List<BeatSource> findBeats(UUID projectId, String ownerId) {
    return mapper.findBeats(projectId, ownerId).stream()
        .map(
            row ->
                new BeatSource(
                    row.getChapterId(),
                    row.getChapterOrderIndex(),
                    row.getMediaPlanId(),
                    row.getMediaPlanRevision(),
                    row.getSceneIndex(),
                    row.getBeatIndex(),
                    row.getVisualBeatId(),
                    row.getTitle(),
                    row.getVisualIntent(),
                    row.getCameraMovement(),
                    row.getAssetStrategy(),
                    row.getAudioStartMs(),
                    row.getAudioEndMs(),
                    row.getAudioDurationMs(),
                    row.getMediaAssetId(),
                    row.getStorageKey(),
                    row.getSizeBytes(),
                    row.getChecksum()))
        .toList();
  }
}
