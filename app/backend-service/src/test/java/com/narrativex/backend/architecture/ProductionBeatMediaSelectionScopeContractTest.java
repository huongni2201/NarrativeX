package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import org.junit.jupiter.api.Test;
import org.xml.sax.SAXException;

class ProductionBeatMediaSelectionScopeContractTest {
  private static final Path MAPPER_DIR = Path.of("src/main/resources/mybatis");
  private static final Path SELECTION_MAPPER =
      MAPPER_DIR.resolve("ProductionBeatMediaSelectionMapper.xml");
  private static final Path HARD_CUTOVER_SCHEMA =
      Path.of("src/main/resources/db/migration/V9__device_local_project_media_hard_cutover.sql");

  @Test
  void projectMediaUsesDirectProjectOwnershipWithoutStorageMode() throws IOException {
    String mapper = Files.readString(SELECTION_MAPPER);
    String migration = Files.readString(HARD_CUTOVER_SCHEMA);

    assertTrue(mapper.contains("ma.project_id = #{projectId"));
    assertFalse(mapper.contains("local_media_materializations"));
    assertFalse(mapper.contains("storage_mode"));
    assertTrue(migration.contains("ALTER TABLE media_assets ALTER COLUMN project_id SET NOT NULL"));
    assertTrue(migration.contains("ALTER TABLE media_assets DROP COLUMN storage_mode"));
    assertTrue(migration.contains("DROP TABLE IF EXISTS local_media_materializations"));
    assertTrue(migration.contains("CREATE TABLE voice_reference_assets"));
  }

  @Test
  void allMybatisMappersRemainWellFormedXml()
      throws IOException, ParserConfigurationException, SAXException {
    var factory = DocumentBuilderFactory.newInstance();
    factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
    factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
    factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

    try (Stream<Path> files = Files.list(MAPPER_DIR)) {
      for (Path mapper : files.filter(path -> path.toString().endsWith(".xml")).sorted().toList()) {
        try (var input = Files.newInputStream(mapper)) {
          factory.newDocumentBuilder().parse(input);
        }
      }
    }
  }
}
