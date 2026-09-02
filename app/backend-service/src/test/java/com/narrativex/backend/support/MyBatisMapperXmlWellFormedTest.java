package com.narrativex.backend.support;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import javax.xml.parsers.DocumentBuilderFactory;
import org.junit.jupiter.api.Test;

class MyBatisMapperXmlWellFormedTest {

  @Test
  void everyMyBatisMapperIsWellFormedXml() throws Exception {
    Path mapperDirectory = Path.of("src/main/resources/mybatis");
    List<Path> mappers;
    try (var files = Files.list(mapperDirectory)) {
      mappers =
          files.filter(path -> path.getFileName().toString().endsWith(".xml")).sorted().toList();
    }
    assertFalse(mappers.isEmpty(), "No MyBatis mapper XML files were discovered");

    for (Path mapper : mappers) {
      assertDoesNotThrow(
          () -> {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature(
                "http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);

            try (InputStream input = Files.newInputStream(mapper)) {
              factory.newDocumentBuilder().parse(input);
            }
          },
          () -> "Malformed MyBatis mapper XML: " + mapper);
    }
  }
}
