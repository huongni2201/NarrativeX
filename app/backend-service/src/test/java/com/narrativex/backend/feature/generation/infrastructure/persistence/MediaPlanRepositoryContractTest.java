package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.generation.application.port.out.MediaPlanRepository;
import com.narrativex.backend.feature.generation.infrastructure.persistence.adapter.MyBatisMediaPlanPersistenceAdapter;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.MediaPlanMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MediaPlanRepositoryContractTest {
  @Test
  void existenceContractUsesOnlyPlanRevisionAndChapter() throws Exception {
    var method = MediaPlanRepository.class.getMethod(
        "existsForChapter", UUID.class, int.class, UUID.class);
    assertEquals(boolean.class, method.getReturnType());
    assertEquals(3, method.getParameterCount());
    assertEquals(
        method.getGenericReturnType(),
        MediaPlanMapper.class.getMethod("existsForChapter", UUID.class, int.class, UUID.class)
            .getGenericReturnType());
    assertEquals(
        method.getGenericReturnType(),
        MyBatisMediaPlanPersistenceAdapter.class
            .getMethod("existsForChapter", UUID.class, int.class, UUID.class)
            .getGenericReturnType());
    assertThrows(
        NoSuchMethodException.class,
        () -> MediaPlanRepository.class.getMethod(
            String.join("", "exists", "Owned", "For", "Chapter"),
            UUID.class,
            int.class,
            UUID.class,
            String.class));
  }
}
