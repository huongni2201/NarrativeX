package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.VisualBeatResponse;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.StoryboardRepository;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreateVisualBeatUseCase {
  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterRepository chapterRepository;
  private final StoryboardRepository storyboardRepository;

  @Transactional
  public ApiResponse<VisualBeatResponse> execute(
      UUID projectId, UUID chapterId, UUID sceneId, String title, String visualIntent) {
    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(
        projectId, chapter.getStoryVersionId(), currentUserId.get());

    var scene =
        storyboardRepository
            .findSceneByIdForUpdate(sceneId, chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Scene not found"));

    int orderIndex = storyboardRepository.nextVisualBeatOrderIndex(scene.getId());
    VisualBeat saved =
        storyboardRepository.saveVisualBeat(
            new VisualBeat(scene.getId(), orderIndex, title, visualIntent));
    log.info(
        "Created visual beat id={} (orderIndex={}, title='{}') in sceneId={}, chapterId={}, projectId={}",
        saved.getId(),
        saved.getOrderIndex(),
        saved.getTitle(),
        sceneId,
        chapterId,
        projectId);
    return ApiResponse.success("Visual beat created successfully", VisualBeatResponse.from(saved));
  }
}
