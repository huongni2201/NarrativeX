package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisSafetyGate;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcChapterAnalysisSafetyGate implements ChapterAnalysisSafetyGate {
  private final JdbcTemplate jdbcTemplate;

  @Override
  public void requireAllowed(Long projectId, ChapterAnalysisSource source) {
    String result =
        jdbcTemplate
            .query(
                """
                SELECT result
                  FROM moderation_decisions
                 WHERE project_id = ?
                   AND entity_type = 'CHAPTER'
                   AND entity_id = ?
                 ORDER BY created_at DESC, id DESC
                 LIMIT 1
                """,
                (rs, rowNum) -> rs.getString("result"),
                projectId,
                source.chapterId().toString())
            .stream()
            .findFirst()
            .orElse(null);
    if ("BLOCK".equalsIgnoreCase(result) || "REVIEW".equalsIgnoreCase(result)) {
      throw new GenerationAdmissionDeniedException(
          "SAFETY_BLOCKED", "Chapter analysis is not allowed by the current safety decision.");
    }
  }
}
