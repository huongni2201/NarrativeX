package com.narrativex.backend.shared.domain;

/** Marker base for an aggregate root and its optimistic-concurrency version. */
public abstract class AggregateRoot extends DomainEntity {

    protected AggregateRoot() {
        super();
    }

    protected AggregateRoot(Long id, long rowVersion) {
        super(id, rowVersion);
    }
}
