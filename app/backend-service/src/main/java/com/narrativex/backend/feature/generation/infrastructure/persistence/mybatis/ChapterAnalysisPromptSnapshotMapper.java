package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import java.util.UUID;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

public interface ChapterAnalysisPromptSnapshotMapper extends NarrativeXMyBatisMapper {
  @Insert(
      """
      INSERT INTO chapter_analysis_prompt_snapshots (
          generation_job_id, settings_revision, instruction, instruction_hash)
      VALUES (#{generationJobId}, #{settingsRevision}, #{instruction}, #{instructionHash})
      """)
  int insert(
      @Param("generationJobId") UUID generationJobId,
      @Param("settingsRevision") long settingsRevision,
      @Param("instruction") String instruction,
      @Param("instructionHash") String instructionHash);

  @Select(
      """
      SELECT generation_job_id AS generationJobId, settings_revision AS settingsRevision,
             instruction, instruction_hash AS instructionHash
        FROM chapter_analysis_prompt_snapshots
       WHERE generation_job_id = #{generationJobId}
      """)
  ChapterAnalysisPromptSnapshotRow find(@Param("generationJobId") UUID generationJobId);
}
