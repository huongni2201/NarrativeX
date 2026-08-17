package com.narrativex.backend.modules.storyboard.domain.model;

import com.narrativex.backend.shared.domain.DomainEntity;
import java.util.Objects;

/** Storyboard entity; its persistence mapping belongs to infrastructure. */
public final class Chapter extends DomainEntity {

    private final Long storyVersionId;
    private final int orderIndex;
    private final String title;

    public Chapter(Long storyVersionId, int orderIndex, String title) {
        this(null, 0L, storyVersionId, orderIndex, title);
    }

    private Chapter(Long id, long rowVersion, Long storyVersionId, int orderIndex, String title) {
        super(id, rowVersion);
        this.storyVersionId = Objects.requireNonNull(storyVersionId, "storyVersionId");
        this.orderIndex = orderIndex;
        this.title = Objects.requireNonNull(title, "title");
    }

    public static Chapter rehydrate(Long id, long rowVersion, Long storyVersionId, int orderIndex, String title) {
        return new Chapter(id, rowVersion, storyVersionId, orderIndex, title);
    }

    public Long getStoryVersionId() { return storyVersionId; }
    public int getOrderIndex() { return orderIndex; }
    public String getTitle() { return title; }
}
