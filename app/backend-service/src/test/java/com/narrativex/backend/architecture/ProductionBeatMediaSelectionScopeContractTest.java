package com.narrativex.backend.architecture;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class ProductionBeatMediaSelectionScopeContractTest {
  @Test
  void localOnlySelectionRequiresAvailabilityInCurrentProject() throws IOException {
    String mapper =
        Files.readString(
            Path.of("src/main/resources/mybatis/ProductionBeatMediaSelectionMapper.xml"));

    assertTrue(mapper.contains("ma.storage_mode <> 'LOCAL_ONLY'"));
    assertTrue(mapper.contains("lmm.project_id = #{projectId"));
    assertTrue(mapper.contains("lmm.media_asset_id = ma.id"));
    assertTrue(mapper.contains("lmm.state = 'AVAILABLE'"));
  }
}
