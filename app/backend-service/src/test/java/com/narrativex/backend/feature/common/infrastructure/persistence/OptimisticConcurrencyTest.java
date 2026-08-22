package com.narrativex.backend.feature.common.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.dao.OptimisticLockingFailureException;

class OptimisticConcurrencyTest {
  @Test
  void acceptsMatchingVersion() {
    assertDoesNotThrow(() -> OptimisticConcurrency.requireVersion(4L, 4L, Object.class, 10L));
  }

  @Test
  void rejectsStaleVersion() {
    assertThrows(
        OptimisticLockingFailureException.class,
        () -> OptimisticConcurrency.requireVersion(3L, 4L, Object.class, 10L));
  }
}
