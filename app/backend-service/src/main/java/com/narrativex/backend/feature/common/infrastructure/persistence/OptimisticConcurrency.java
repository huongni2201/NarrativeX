package com.narrativex.backend.feature.common.infrastructure.persistence;

import org.springframework.dao.OptimisticLockingFailureException;

/** Guards detached domain state from silently overwriting a newer JPA row. */
public final class OptimisticConcurrency {
  private OptimisticConcurrency() {}

  public static void requireVersion(
      long expectedVersion, long actualVersion, Class<?> persistentType, Object id) {
    if (expectedVersion != actualVersion) {
      throw new OptimisticLockingFailureException(
          persistentType.getSimpleName() + " " + id + " was modified concurrently");
    }
  }
}
