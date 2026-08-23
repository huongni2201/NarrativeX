package com.narrativex.backend.feature.common.domain;

import java.util.UUID;

/** Entity base for domain identities backed by PostgreSQL UUIDv7 values. */
public abstract class UuidDomainEntity {
  private final UUID id;
  private final long rowVersion;

  protected UuidDomainEntity(UUID id, long rowVersion) {
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
