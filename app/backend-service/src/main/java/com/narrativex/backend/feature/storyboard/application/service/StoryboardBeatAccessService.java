package com.narrativex.backend.feature.storyboard.application.service;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardBeatAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.StoryboardRepository;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StoryboardBeatAccessService implements StoryboardBeatAccess {
  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
  private final ChapterRepository chapterRepository;
  private final StoryboardRepository storyboardRepository;

  @Override
  @Transactional(readOnly = true)
  public Set<UUID> requireCurrentBeatIds(UUID projectId, UUID chapterId) {
    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    storyVersionAccess.requireOwnedStoryVersion(
        projectId, chapter.getStoryVersionId(), currentUserId.get());
    var sceneIds =
        storyboardRepository.findScenesByChapterId(chapterId).stream()
            .map(scene -> scene.getId())
            .toList();
    return storyboardRepository.findVisualBeatsBySceneIds(sceneIds).stream()
        .map(beat -> beat.getId())
        .collect(Collectors.toUnmodifiableSet());
  }
}
