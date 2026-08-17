package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;

/** Storyboard chapter entity tied to a story-version snapshot. */
public final class Chapter extends DomainEntity {
    private final Long storyVersionId;
    private final int orderIndex;
    private final String title;

    public Chapter(Long storyVersionId, int orderIndex, String title) {
        this(null, 0L, storyVersionId, orderIndex, title);
    }

    private Chapter(Long id, long rowVersion, Long storyVersionId, int orderIndex, String title) {
        super(id, rowVersion);
        if (storyVersionId == null || storyVersionId <= 0) throw new IllegalArgumentException("storyVersionId must be positive");
        if (orderIndex < 0) throw new IllegalArgumentException("orderIndex must not be negative");
        if (title == null || title.isBlank()) throw new IllegalArgumentException("title must not be blank");
        this.storyVersionId = storyVersionId;
        this.orderIndex = orderIndex;
        this.title = title;
    }

    public static Chapter rehydrate(Long id, long rowVersion, Long storyVersionId, int orderIndex, String title) {
        return new Chapter(id, rowVersion, storyVersionId, orderIndex, title);
    }

    public Long getStoryVersionId() { return storyVersionId; }
    public int getOrderIndex() { return orderIndex; }
    public String getTitle() { return title; }
}
