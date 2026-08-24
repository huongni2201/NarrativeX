package com.narrativex.backend.feature.common.infrastructure.persistence;

import org.springframework.dao.OptimisticLockingFailureException;

/** Guards detached domain state from silently recreating or overwriting durable rows. */
public final class OptimisticConcurrency {
  private OptimisticConcurrency() {}

  public static void requirePresent(Object persistentRow, Class<?> persistentType, Object id) {
    if (persistentRow == null) {
      throw new OptimisticLockingFailureException(
          persistentType.getSimpleName() + " " + id + " no longer exists");
    }
  }

  public static void requireVersion(
      long expectedVersion, long actualVersion, Class<?> persistentType, Object id) {
    if (expectedVersion != actualVersion) {
      throw new OptimisticLockingFailureException(
          persistentType.getSimpleName() + " " + id + " was modified concurrently");
    }
  }
}
