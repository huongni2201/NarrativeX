package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import com.narrativex.backend.feature.storyboard.application.port.out.StoryboardRepository;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Scene;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.entity.SceneJpaEntity;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.entity.VisualBeatJpaEntity;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.repository.SceneJpaRepository;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.repository.VisualBeatJpaRepository;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class StoryboardPersistenceAdapter implements StoryboardRepository {
  private final SceneJpaRepository sceneRepository;
  private final VisualBeatJpaRepository visualBeatRepository;

  @Override
  public List<Scene> findScenesByChapterId(Long chapterId) {
    return sceneRepository.findCurrentByChapterId(chapterId).stream()
        .map(StoryboardPersistenceAdapter::toDomain)
        .toList();
  }

  @Override
  public List<VisualBeat> findVisualBeatsBySceneIds(List<Long> sceneIds) {
    if (sceneIds.isEmpty()) {
      return List.of();
    }
    return visualBeatRepository
        .findAllBySceneIdInOrderBySceneIdAscOrderIndexAscIdAsc(sceneIds)
        .stream()
        .map(StoryboardPersistenceAdapter::toDomain)
        .toList();
  }

  @Override
  public Optional<Scene> findSceneById(Long sceneId) {
    return sceneRepository.findById(sceneId).map(StoryboardPersistenceAdapter::toDomain);
  }

  @Override
  public Optional<Scene> findSceneByIdForUpdate(Long sceneId, Long chapterId) {
    return sceneRepository
        .findByIdAndChapterIdForUpdate(sceneId, chapterId)
        .map(StoryboardPersistenceAdapter::toDomain);
  }

  @Override
  public Optional<VisualBeat> findVisualBeatById(Long visualBeatId) {
    return visualBeatRepository.findById(visualBeatId).map(StoryboardPersistenceAdapter::toDomain);
  }

  @Override
  public int nextVisualBeatOrderIndex(Long sceneId) {
    int currentMax = visualBeatRepository.findMaxOrderIndexBySceneId(sceneId);
    if (currentMax == Integer.MAX_VALUE) {
      throw new IllegalStateException("Visual beat order index is exhausted for scene " + sceneId);
    }
    return currentMax + 1;
  }

  @Override
  public VisualBeat saveVisualBeat(VisualBeat visualBeat) {
    VisualBeatJpaEntity entity;
    if (visualBeat.getId() == null) {
      entity =
          VisualBeatJpaEntity.builder()
              .sceneId(visualBeat.getSceneId())
              .orderIndex(visualBeat.getOrderIndex())
              .title(visualBeat.getTitle())
              .visualIntent(visualBeat.getVisualIntent())
              .reviewStatus(visualBeat.getReviewStatus())
              .motionMode(visualBeat.getMotionMode())
              .cameraMovement(visualBeat.getCameraMovement())
              .aspectRatioOverride(visualBeat.getAspectRatioOverride())
              .qualityTierOverride(visualBeat.getQualityTierOverride())
              .previewAssetId(visualBeat.getPreviewAssetId())
              .build();
    } else {
      entity =
          visualBeatRepository
              .findById(visualBeat.getId())
              .orElseThrow(() -> new ResourceNotFoundException("Visual beat not found"));
      OptimisticConcurrency.requireVersion(
          visualBeat.getRowVersion(),
          entity.getRowVersion(),
          VisualBeatJpaEntity.class,
          visualBeat.getId());
      entity.setTitle(visualBeat.getTitle());
      entity.setVisualIntent(visualBeat.getVisualIntent());
      entity.setReviewStatus(visualBeat.getReviewStatus());
      entity.setMotionMode(visualBeat.getMotionMode());
      entity.setCameraMovement(visualBeat.getCameraMovement());
      entity.setAspectRatioOverride(visualBeat.getAspectRatioOverride());
      entity.setQualityTierOverride(visualBeat.getQualityTierOverride());
    }
    return toDomain(visualBeatRepository.saveAndFlush(entity));
  }

  private static Scene toDomain(SceneJpaEntity entity) {
    return Scene.rehydrate(
        entity.getId(),
        entity.getRowVersion(),
        entity.getChapterId(),
        entity.getOrderIndex(),
        entity.getTitle(),
        entity.getNarration(),
        entity.getDurationSeconds(),
        entity.getStatus());
  }

  private static VisualBeat toDomain(VisualBeatJpaEntity entity) {
    VisualBeat beat =
        VisualBeat.rehydrate(
            entity.getId(),
            entity.getRowVersion(),
            entity.getSceneId(),
            entity.getOrderIndex(),
            entity.getTitle(),
            entity.getVisualIntent(),
            entity.getMotionMode(),
            entity.getCameraMovement(),
            entity.getAspectRatioOverride(),
            entity.getQualityTierOverride(),
            entity.getReviewStatus());
    beat.attachPreviewAsset(entity.getPreviewAssetId());
    return beat;
  }
}
