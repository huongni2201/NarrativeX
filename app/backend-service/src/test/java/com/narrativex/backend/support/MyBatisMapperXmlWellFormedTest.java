package com.narrativex.backend.support;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import java.io.InputStream;
import javax.xml.parsers.DocumentBuilderFactory;
import org.junit.jupiter.api.Test;

class MyBatisMapperXmlWellFormedTest {

    @Test
    void productionBeatMediaSelectionMapperIsWellFormedXml() {
        assertDoesNotThrow(() -> {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

            try (InputStream input = getClass().getResourceAsStream("/mybatis/ProductionBeatMediaSelectionMapper.xml")) {
                if (input == null) {
                    throw new IllegalStateException("ProductionBeatMediaSelectionMapper.xml is missing from the test classpath");
                }
                factory.newDocumentBuilder().parse(input);
            }
        });
    }
}
