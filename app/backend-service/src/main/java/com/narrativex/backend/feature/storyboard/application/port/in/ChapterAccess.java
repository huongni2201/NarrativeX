package com.narrativex.backend.feature.storyboard.application.port.in;

import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import java.util.Optional;

public interface ChapterAccess {
  Optional<Chapter> findById(Long chapterId);
}
