package com.narrativex.backend.modules.storyboard.domain;

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
@Table(name = "scenes", uniqueConstraints = @UniqueConstraint(
    name = "uk_scenes_chapter_order", columnNames = {"chapter_id", "order_index"}))
public class Scene extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chapter_id", nullable = false, foreignKey = @ForeignKey(name = "fk_scenes_chapter"))
    private Chapter chapter;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "narration", columnDefinition = "TEXT")
    private String narration;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    protected Scene() {
    }

    public Scene(Chapter chapter, int orderIndex, String title) {
        this.chapter = chapter;
        this.orderIndex = orderIndex;
        this.title = title;
    }

    public Chapter getChapter() {
        return chapter;
    }

    public int getOrderIndex() {
        return orderIndex;
    }

    public String getTitle() {
        return title;
    }

    public String getNarration() {
        return narration;
    }

    public Integer getDurationSeconds() {
        return durationSeconds;
    }
}
