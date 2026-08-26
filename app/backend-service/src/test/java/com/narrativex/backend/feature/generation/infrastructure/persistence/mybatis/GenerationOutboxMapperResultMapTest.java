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

class GenerationOutboxMapperResultMapTest {
  private static final String RESOURCE = "mybatis/GenerationOutboxMapper.xml";
  private static final String NAMESPACE =
      "com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationOutboxMapper";

  @Test
  void reserveBatchExplicitlyMapsTheOnlyRequiredDispatchColumn() throws Exception {
    Configuration configuration = new Configuration();
    configuration.setMapUnderscoreToCamelCase(false);

    try (InputStream input = Resources.getResourceAsStream(RESOURCE)) {
      new XMLMapperBuilder(input, configuration, RESOURCE, configuration.getSqlFragments()).parse();
    }

    ResultMap resultMap =
        configuration.getMappedStatement(NAMESPACE + ".reserveBatch").getResultMaps().get(0);
    Map<String, String> mappings =
        resultMap.getResultMappings().stream()
            .collect(Collectors.toMap(ResultMapping::getProperty, ResultMapping::getColumn));

    assertThat(mappings).containsExactlyInAnyOrderEntriesOf(Map.of("id", "id"));
  }
}
