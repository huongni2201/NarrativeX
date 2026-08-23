package com.narrativex.backend.feature.storyboard.application.port.in;

import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import java.util.Optional;
import java.util.UUID;

public interface ChapterAccess {
  Optional<Chapter> findById(UUID chapterId);
}
