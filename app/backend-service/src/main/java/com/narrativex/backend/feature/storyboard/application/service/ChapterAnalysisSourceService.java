package com.narrativex.backend.feature.storyboard.application.service;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ChapterAnalysisSourceService implements ChapterAnalysisSourceAccess {
  private final ChapterRepository chapterRepository;

  @Override
  public ChapterAnalysisSource requireById(Long chapterId) {
    var chapter =
        chapterRepository
            .findById(chapterId)
            .orElseThrow(() -> new ResourceNotFoundException("Chapter not found"));
    return new ChapterAnalysisSource(
        chapter.getId(),
        chapter.getStoryVersionId(),
        chapter.getRowVersion(),
        chapter.getSourceHash(),
        chapter.getSourceText());
  }
}
