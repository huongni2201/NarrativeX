package com.narrativex.backend.feature.common.domain;

import java.util.Objects;
import java.util.UUID;

/** Framework-free identity base reserved for aggregate roots. Internal identities use UUIDv7. */
public abstract class AggregateRoot {
  private final UUID id;
  private final long rowVersion;

  protected AggregateRoot() {
    this(null, 0L);
  }

  protected AggregateRoot(UUID id, long rowVersion) {
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

  @Override
  public final boolean equals(Object other) {
    if (this == other) return true;
    if (other == null || getClass() != other.getClass()) return false;
    AggregateRoot that = (AggregateRoot) other;
    return id != null && Objects.equals(id, that.id);
  }

  @Override
  public final int hashCode() {
    return getClass().hashCode();
  }
}
