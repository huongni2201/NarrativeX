package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisSafetyGate;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ChapterAnalysisSafetyMapper;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MyBatisChapterAnalysisSafetyGate implements ChapterAnalysisSafetyGate {
  private final ChapterAnalysisSafetyMapper mapper;
  private final StoryboardRevisionAccess storyboardRevisionAccess;

  @Override
  public void requireAllowed(Long projectId, ChapterAnalysisSource source) {
    var currentRevision = storyboardRevisionAccess.current(source.chapterId());
    if (currentRevision.hasApprovedOutput()
        && Objects.equals(currentRevision.sourceHash(), source.sourceHash())) {
      throw new GenerationAdmissionDeniedException(
          "APPROVED_STORYBOARD_PROTECTED",
          "The current storyboard contains approved output for this exact chapter source. "
              + "Edit the chapter before requesting a new analysis revision.");
    }

    String result = mapper.findLatestModerationResult(projectId, source.chapterId().toString());
    if ("BLOCK".equalsIgnoreCase(result) || "REVIEW".equalsIgnoreCase(result)) {
      throw new GenerationAdmissionDeniedException(
          "SAFETY_BLOCKED", "Chapter analysis is not allowed by the current safety decision.");
    }
  }
}
