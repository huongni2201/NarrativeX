package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.util.Map;
import java.util.stream.Collectors;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.io.Resources;
import org.apache.ibatis.mapping.ResultMap;
import org.apache.ibatis.mapping.ResultMapping;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.Test;

class VisualPromptContextMapperResultMapTest {
  private static final String RESOURCE = "mybatis/VisualPromptContextMapper.xml";
  private static final String NAMESPACE =
      "com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.VisualPromptContextMapper";

  @Test
  void explicitlyMapsSnakeCaseColumnsWhenGlobalUnderscoreMappingIsDisabled() throws Exception {
    Configuration configuration = new Configuration();
    configuration.setMapUnderscoreToCamelCase(false);

    try (InputStream input = Resources.getResourceAsStream(RESOURCE)) {
      new XMLMapperBuilder(input, configuration, RESOURCE, configuration.getSqlFragments()).parse();
    }

    assertMappings(
        configuration,
        "findLocation",
        Map.of(
            "locationId", "location_id",
            "name", "name",
            "description", "description",
            "visualPrompt", "visual_prompt"));

    assertMappings(
        configuration,
        "findCharacters",
        Map.ofEntries(
            Map.entry("assignmentId", "assignment_id"),
            Map.entry("characterId", "character_id"),
            Map.entry("canonicalName", "canonical_name"),
            Map.entry("versionNumber", "version_number"),
            Map.entry("visualPrompt", "visual_prompt"),
            Map.entry("appearancePrompt", "appearance_prompt"),
            Map.entry("ageState", "age_state"),
            Map.entry("hairstyle", "hairstyle"),
            Map.entry("injury", "injury"),
            Map.entry("wardrobeContext", "wardrobe_context")));

    assertMappings(
        configuration,
        "findCharacterReferences",
        Map.of(
            "assignmentId", "assignment_id",
            "assetId", "asset_id",
            "role", "role",
            "priority", "priority",
            "storageKey", "storage_key",
            "contentType", "content_type",
            "sha256", "sha256"));
  }

  private static void assertMappings(
      Configuration configuration, String statementId, Map<String, String> expected) {
    ResultMap resultMap =
        configuration.getMappedStatement(NAMESPACE + "." + statementId).getResultMaps().get(0);
    Map<String, String> actual =
        resultMap.getResultMappings().stream()
            .collect(Collectors.toMap(ResultMapping::getProperty, ResultMapping::getColumn));

    assertThat(actual).containsAllEntriesOf(expected);
  }
}
