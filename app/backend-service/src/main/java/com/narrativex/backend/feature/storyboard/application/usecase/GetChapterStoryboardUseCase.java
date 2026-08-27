package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterStoryboardResponse;
import com.narrativex.backend.feature.storyboard.api.response.VisualBeatResponse;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.StoryboardRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.VisualBeatPromptProvider;
import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import com.narrativex.backend.feature.storyboard.domain.enums.VisualBeatReviewStatus;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class GetChapterStoryboardUseCase {
  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterRepository chapterRepository;
  private final StoryboardRepository storyboardRepository;
  private final VisualBeatPromptProvider visualBeatPromptProvider;

  @Transactional(readOnly = true)
  public ApiResponse<ChapterStoryboardResponse> execute(UUID projectId, UUID chapterId) {
    log.debug("Fetching storyboard for projectId={}, chapterId={}", projectId, chapterId);
    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(
        projectId, chapter.getStoryVersionId(), currentUserId.get());

    var scenes = storyboardRepository.findScenesByChapterId(chapterId);
    List<UUID> sceneIds = scenes.stream().map(scene -> scene.getId()).toList();
    Map<UUID, List<VisualBeat>> beatsByScene =
        storyboardRepository.findVisualBeatsBySceneIds(sceneIds).stream()
            .collect(Collectors.groupingBy(VisualBeat::getSceneId));
    List<ChapterStoryboardResponse.SceneItem> sceneItems =
        scenes.stream()
            .map(
                scene -> {
                  List<VisualBeat> beats = beatsByScene.getOrDefault(scene.getId(), List.of());
                  int approved =
                      (int)
                          beats.stream()
                              .filter(
                                  beat -> beat.getReviewStatus() == VisualBeatReviewStatus.APPROVED)
                              .count();
                  return new ChapterStoryboardResponse.SceneItem(
                      scene.getId(),
                      scene.getOrderIndex(),
                      scene.getTitle(),
                      scene.getStatus(),
                      approved,
                      beats.size(),
                      beats.stream()
                          .map(
                              beat ->
                                  VisualBeatResponse.from(
                                      beat,
                                      visualBeatPromptProvider.promptFor(projectId, beat)))
                          .toList());
                })
            .toList();

    return ApiResponse.success(
        new ChapterStoryboardResponse(
            new ChapterStoryboardResponse.ChapterItem(
                chapter.getId(), chapter.getOrderIndex(), chapter.getTitle()),
            sceneItems));
  }
}
