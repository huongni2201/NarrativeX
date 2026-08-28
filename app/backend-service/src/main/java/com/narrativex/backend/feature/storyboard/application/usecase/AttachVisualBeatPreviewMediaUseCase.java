package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.assets.application.port.in.MediaAssetAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.VisualBeatResponse;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.StoryboardRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AttachVisualBeatPreviewMediaUseCase {
  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterRepository chapterRepository;
  private final StoryboardRepository storyboardRepository;
  private final StoryboardRevisionAccess storyboardRevisionAccess;
  private final MediaAssetAccess mediaAssetAccess;

  @Transactional
  public ApiResponse<VisualBeatResponse> execute(
      UUID projectId,
      UUID chapterId,
      UUID sceneId,
      UUID visualBeatId,
      long expectedRowVersion,
      UUID mediaAssetId) {
    storyboardRevisionAccess.lockChapter(chapterId);
    String ownerId = currentUserId.get();
    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(projectId, chapter.getStoryVersionId(), ownerId);

    var scene =
        storyboardRepository
            .findSceneById(sceneId)
            .filter(candidate -> chapterId.equals(candidate.getChapterId()))
            .orElseThrow(() -> new ResourceNotFoundException("Scene not found"));
    var visualBeat =
        storyboardRepository
            .findVisualBeatById(visualBeatId)
            .filter(candidate -> scene.getId().equals(candidate.getSceneId()))
            .orElseThrow(() -> new ResourceNotFoundException("Visual beat not found"));
    if (visualBeat.getRowVersion() != expectedRowVersion) {
      throw new ResourceConflictException(
          "Visual beat was changed by another request; refresh and try again");
    }

    var asset =
        mediaAssetAccess
            .findOwnedSummary(ownerId, mediaAssetId)
            .orElseThrow(() -> new ResourceNotFoundException("Preview media asset not found"));
    String contentType =
        asset.detectedContentType() == null ? asset.contentType() : asset.detectedContentType();
    if (!"IMAGE".equals(asset.type())
        || !"READY".equals(asset.status())
        || contentType == null
        || !contentType.startsWith("image/")) {
      throw new ResourceConflictException("Visual beat preview must be a READY image asset");
    }

    visualBeat.attachPreviewMediaAsset(mediaAssetId);
    var saved = storyboardRepository.saveVisualBeat(visualBeat);
    return ApiResponse.success("Visual beat preview media updated", VisualBeatResponse.from(saved));
  }
}
