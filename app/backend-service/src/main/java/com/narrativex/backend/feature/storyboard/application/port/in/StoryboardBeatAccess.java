package com.narrativex.backend.feature.storyboard.application.port.in;

import com.narrativex.backend.feature.storyboard.domain.entity.VisualBeat;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Narrow cross-feature capability exposing the current owned storyboard beat scope. */
public interface StoryboardBeatAccess {
  List<VisualBeat> requireCurrentBeats(UUID projectId, UUID chapterId);

  default Set<UUID> requireCurrentBeatIds(UUID projectId, UUID chapterId) {
    return requireCurrentBeats(projectId, chapterId).stream()
        .map(VisualBeat::getId)
        .collect(Collectors.toUnmodifiableSet());
  }
}
