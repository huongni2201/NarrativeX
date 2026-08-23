package com.narrativex.backend.feature.common.domain;

import java.util.Objects;
import java.util.UUID;

/** Framework-free identity base for child entities owned by an aggregate root. Internal identities use UUIDv7. */
public abstract class DomainEntity {
  private final UUID id;
  private final long rowVersion;

  protected DomainEntity() {
    this(null, 0L);
  }

  protected DomainEntity(UUID id, long rowVersion) {
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
    DomainEntity that = (DomainEntity) other;
    return id != null && Objects.equals(id, that.id);
  }

  @Override
  public final int hashCode() {
    return getClass().hashCode();
  }
}
