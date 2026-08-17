package com.narrativex.backend.modules.storyboard.domain;

import com.narrativex.backend.modules.project.domain.StoryVersion;
import com.narrativex.backend.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "chapters", uniqueConstraints = @UniqueConstraint(
    name = "uk_chapters_story_order", columnNames = {"story_version_id", "order_index"}))
public class Chapter extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "story_version_id", nullable = false,
        foreignKey = @ForeignKey(name = "fk_chapters_story_version"))
    private StoryVersion storyVersion;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    protected Chapter() {
    }

    public Chapter(StoryVersion storyVersion, int orderIndex, String title) {
        this.storyVersion = storyVersion;
        this.orderIndex = orderIndex;
        this.title = title;
    }

    public StoryVersion getStoryVersion() {
        return storyVersion;
    }

    public int getOrderIndex() {
        return orderIndex;
    }

    public String getTitle() {
        return title;
    }
}
