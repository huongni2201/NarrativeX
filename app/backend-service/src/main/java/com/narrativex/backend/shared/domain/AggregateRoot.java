package com.narrativex.backend.shared.domain;

import java.util.Objects;

/** Framework-free identity base reserved for aggregate roots. */
public abstract class AggregateRoot {

    private final Long id;
    private final long rowVersion;

    protected AggregateRoot() {
        this(null, 0L);
    }

    protected AggregateRoot(Long id, long rowVersion) {
        this.id = id;
        this.rowVersion = rowVersion;
    }

    public Long getId() {
        return id;
    }

    public long getRowVersion() {
        return rowVersion;
    }

    @Override
    public final boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (other == null || getClass() != other.getClass()) {
            return false;
        }
        AggregateRoot that = (AggregateRoot) other;
        return id != null && Objects.equals(id, that.id);
    }

    @Override
    public final int hashCode() {
        return getClass().hashCode();
    }
}
