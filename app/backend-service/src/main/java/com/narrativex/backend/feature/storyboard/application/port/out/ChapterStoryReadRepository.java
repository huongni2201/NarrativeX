package com.narrativex.backend.feature.storyboard.application.port.out;

import com.narrativex.backend.feature.storyboard.api.response.ChapterStoryResponse;
import java.util.UUID;

public interface ChapterStoryReadRepository {
  ChapterStoryResponse get(UUID projectId, UUID chapterId);
}
