package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

public interface PromptSettingsMapper extends NarrativeXMyBatisMapper {
  @Select(
      """
      SELECT revision, settings::text AS settingsJson
        FROM prompt_settings
       WHERE singleton_id = TRUE
      """)
  PromptSettingsRow find();

  @Insert(
      """
      INSERT INTO prompt_settings (singleton_id, revision, format_version, settings, semantic_hash)
      VALUES (TRUE, 1, #{formatVersion}, CAST(#{settingsJson} AS JSONB), #{semanticHash})
      ON CONFLICT (singleton_id) DO NOTHING
      """)
  int insertIfAbsent(
      @Param("formatVersion") int formatVersion,
      @Param("settingsJson") String settingsJson,
      @Param("semanticHash") String semanticHash);

  @Update(
      """
      UPDATE prompt_settings
         SET revision = revision + 1,
             format_version = #{formatVersion},
             settings = CAST(#{settingsJson} AS JSONB),
             semantic_hash = #{semanticHash},
             updated_at = CURRENT_TIMESTAMP
       WHERE singleton_id = TRUE AND revision = #{expectedRevision}
      """)
  int update(
      @Param("formatVersion") int formatVersion,
      @Param("settingsJson") String settingsJson,
      @Param("semanticHash") String semanticHash,
      @Param("expectedRevision") long expectedRevision);
}
