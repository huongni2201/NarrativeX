package com.narrativex.backend.feature.common.domain;

import java.util.UUID;

/** Aggregate-root base for domain identities backed by PostgreSQL UUIDv7 values. */
public abstract class UuidAggregateRoot {
  private final UUID id;
  private final long rowVersion;

  protected UuidAggregateRoot(UUID id, long rowVersion) {
    if (rowVersion < 0) throw new IllegalArgumentException("rowVersion must not be negative");
    this.id = id;
    this.rowVersion = rowVersion;
  }

  public UUID getId() {
    return id;
  }

  public long getRowVersion() {
    return rowVersion;
  }
}
