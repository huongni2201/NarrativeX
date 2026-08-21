package com.narrativex.backend.feature.catalog.infrastructure.persistence.adapter;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import com.narrativex.backend.feature.catalog.application.port.out.CatalogQueryRepository;
import com.narrativex.backend.feature.catalog.application.query.StylePresetView;
import com.narrativex.backend.feature.catalog.application.query.VoiceView;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collections;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JdbcCatalogQueryAdapter implements CatalogQueryRepository {
  private static final TypeReference<List<String>> TAGS_TYPE = new TypeReference<>() {};

  private final JdbcTemplate jdbcTemplate;
  private final ObjectMapper objectMapper;

  @Override
  public List<StylePresetView> listStylePresets(String category) {
    String sql =
        "SELECT id, name, category, description, thumbnail_url, prompt_suffix, "
            + "negative_prompt, tags_json::text, config_json::text, created_at "
            + "FROM style_presets WHERE status = 'ACTIVE' "
            + (category == null || category.isBlank() ? "" : "AND category = ? ")
            + "ORDER BY category, LOWER(name), id";
    Object[] args = category == null || category.isBlank() ? new Object[0] : new Object[] {category};
    return jdbcTemplate.query(sql, this::toStylePreset, args);
  }

  @Override
  public List<VoiceView> listVoices(String language) {
    String sql =
        "SELECT id, provider, name, language, gender, sample_url, metadata_json::text, updated_at "
            + "FROM voice_catalog WHERE enabled = TRUE "
            + (language == null || language.isBlank() ? "" : "AND language = ? ")
            + "ORDER BY language, LOWER(name), id";
    Object[] args = language == null || language.isBlank() ? new Object[0] : new Object[] {language};
    return jdbcTemplate.query(sql, this::toVoice, args);
  }

  private StylePresetView toStylePreset(ResultSet rs, int rowNum) throws SQLException {
    return new StylePresetView(
        rs.getLong("id"),
        rs.getString("name"),
        rs.getString("category"),
        rs.getString("description"),
        rs.getString("thumbnail_url"),
        rs.getString("prompt_suffix"),
        rs.getString("negative_prompt"),
        parseTags(rs.getString("tags_json")),
        rs.getString("config_json"),
        rs.getTimestamp("created_at").toInstant());
  }

  private VoiceView toVoice(ResultSet rs, int rowNum) throws SQLException {
    return new VoiceView(
        rs.getString("id"),
        rs.getString("provider"),
        rs.getString("name"),
        rs.getString("language"),
        rs.getString("gender"),
        rs.getString("sample_url"),
        rs.getString("metadata_json"),
        rs.getTimestamp("updated_at").toInstant());
  }

  private List<String> parseTags(String value) {
    try {
      return objectMapper.readValue(value, TAGS_TYPE);
    } catch (Exception ignored) {
      return Collections.emptyList();
    }
  }
}
