package com.narrativex.backend.modules.common.domain;

import java.util.Objects;

/** Framework-free identity base for child entities owned by an aggregate root. */
public abstract class DomainEntity {
    private final Long id;
    private final long rowVersion;

    protected DomainEntity() {
        this(null, 0L);
    }

    protected DomainEntity(Long id, long rowVersion) {
        this.id = id;
        this.rowVersion = rowVersion;
    }

    public Long getId() { return id; }
    public long getRowVersion() { return rowVersion; }

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
