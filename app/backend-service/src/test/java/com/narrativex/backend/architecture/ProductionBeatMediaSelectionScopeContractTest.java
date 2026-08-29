package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import org.junit.jupiter.api.Test;
import org.xml.sax.SAXException;

class ProductionBeatMediaSelectionScopeContractTest {
  private static final Path MAPPER =
      Path.of("src/main/resources/mybatis/ProductionBeatMediaSelectionMapper.xml");

  @Test
  void projectLocalSelectionRequiresDirectProjectOwnership() throws IOException {
    String mapper = Files.readString(MAPPER);

    assertFalse(mapper.contains("ma.storage_mode <> 'LOCAL_ONLY'"));
    assertFalse(mapper.contains("local_media_materializations"));
    assertTrue(mapper.contains("ma.project_id = #{projectId"));
    assertTrue(mapper.contains("ma.storage_mode IN ('PROJECT_LOCAL', 'LOCAL_ONLY')"));
  }

  @Test
  void mapperRemainsWellFormedXml()
      throws IOException, ParserConfigurationException, SAXException {
    var factory = DocumentBuilderFactory.newInstance();
    factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
    factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
    factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

    try (var input = Files.newInputStream(MAPPER)) {
      factory.newDocumentBuilder().parse(input);
    }
  }
}
