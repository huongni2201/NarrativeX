package com.narrativex.backend.feature.storyboard.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import com.narrativex.backend.feature.storyboard.application.port.out.StoryboardRepository;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Scene;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import com.narrativex.backend.feature.storyboard.domain.enums.AspectRatio;
import com.narrativex.backend.feature.storyboard.domain.enums.CameraMovement;
import com.narrativex.backend.feature.storyboard.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionMode;
import com.narrativex.backend.feature.storyboard.domain.enums.SceneStatus;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.SceneRow;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.StoryboardMapper;
import com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis.VisualBeatRow;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisStoryboardPersistenceAdapter implements StoryboardRepository {
  private final StoryboardMapper mapper;
  @Override public List<Scene> findScenesByChapterId(Long id) { return mapper.findCurrentScenes(id).stream().map(MyBatisStoryboardPersistenceAdapter::toDomain).toList(); }
  @Override public List<VisualBeat> findVisualBeatsBySceneIds(List<Long> ids) { return ids.isEmpty() ? List.of() : mapper.findVisualBeats(ids).stream().map(MyBatisStoryboardPersistenceAdapter::toDomain).toList(); }
  @Override public Optional<Scene> findSceneById(Long id) { return Optional.ofNullable(mapper.findScene(id)).map(MyBatisStoryboardPersistenceAdapter::toDomain); }
  @Override public Optional<Scene> findSceneByIdForUpdate(Long id, Long chapterId) { return Optional.ofNullable(mapper.findSceneForUpdate(id, chapterId)).map(MyBatisStoryboardPersistenceAdapter::toDomain); }
  @Override public Optional<VisualBeat> findVisualBeatById(Long id) { return Optional.ofNullable(mapper.findVisualBeat(id)).map(MyBatisStoryboardPersistenceAdapter::toDomain); }
  @Override public int nextVisualBeatOrderIndex(Long sceneId) { int max = mapper.maxVisualBeatOrder(sceneId); if (max == Integer.MAX_VALUE) throw new IllegalStateException("Visual beat order index is exhausted for scene " + sceneId); return max + 1; }
  @Override public VisualBeat saveVisualBeat(VisualBeat value) {
    Instant now = Instant.now(); VisualBeatRow row = new VisualBeatRow(); row.setId(value.getId()); row.setRowVersion(value.getRowVersion()); row.setCreatedAt(now); row.setUpdatedAt(now); row.setSceneId(value.getSceneId()); row.setOrderIndex(value.getOrderIndex()); row.setTitle(value.getTitle()); row.setVisualIntent(value.getVisualIntent()); row.setReviewStatus(value.getReviewStatus().name()); row.setMotionMode(value.getMotionMode().name()); row.setCameraMovement(value.getCameraMovement().name()); row.setAspectRatioOverride(value.getAspectRatioOverride() == null ? null : value.getAspectRatioOverride().name()); row.setQualityTierOverride(value.getQualityTierOverride() == null ? null : value.getQualityTierOverride().name()); row.setPreviewAssetId(value.getPreviewAssetId());
    if (value.getId() == null) { row.setId(null); row.setRowVersion(0); Long id = mapper.insertVisualBeat(row); return toDomain(mapper.findVisualBeat(id)); }
    VisualBeatRow existing = mapper.findVisualBeat(value.getId()); if (existing == null) throw new ResourceNotFoundException("Visual beat not found"); OptimisticConcurrency.requireVersion(value.getRowVersion(), existing.getRowVersion(), VisualBeat.class, value.getId()); if (mapper.updateVisualBeat(row) != 1) throw new org.springframework.dao.OptimisticLockingFailureException("Visual beat was modified concurrently"); return toDomain(mapper.findVisualBeat(value.getId()));
  }
  private static Scene toDomain(SceneRow row) { return Scene.rehydrate(row.getId(),row.getRowVersion(),row.getChapterId(),row.getOrderIndex(),row.getTitle(),row.getNarration(),row.getDurationSeconds(),SceneStatus.valueOf(row.getStatus())); }
  private static VisualBeat toDomain(VisualBeatRow row) { VisualBeat beat = VisualBeat.rehydrate(row.getId(),row.getRowVersion(),row.getSceneId(),row.getOrderIndex(),row.getTitle(),row.getVisualIntent(),MotionMode.valueOf(row.getMotionMode()),CameraMovement.valueOf(row.getCameraMovement()),row.getAspectRatioOverride()==null?null:AspectRatio.valueOf(row.getAspectRatioOverride()),row.getQualityTierOverride()==null?null:ImageQualityTier.valueOf(row.getQualityTierOverride()),VisualBeatReviewStatus.valueOf(row.getReviewStatus())); beat.attachPreviewAsset(row.getPreviewAssetId()); return beat; }
}
