package com.narrativex.backend.modules.storyboard.domain.aggregate;

import com.narrativex.backend.shared.domain.DomainEntity;
import java.util.Objects;

public final class Scene extends DomainEntity {

    private final Long chapterId;
    private final int orderIndex;
    private final String title;
    private final String narration;
    private final Integer durationSeconds;

    public Scene(Long chapterId, int orderIndex, String title) {
        this(null, 0L, chapterId, orderIndex, title, null, null);
    }

    private Scene(Long id, long rowVersion, Long chapterId, int orderIndex, String title,
                  String narration, Integer durationSeconds) {
        super(id, rowVersion);
        this.chapterId = Objects.requireNonNull(chapterId, "chapterId");
        this.orderIndex = orderIndex;
        this.title = Objects.requireNonNull(title, "title");
        this.narration = narration;
        this.durationSeconds = durationSeconds;
    }

    public static Scene rehydrate(Long id, long rowVersion, Long chapterId, int orderIndex, String title,
                                  String narration, Integer durationSeconds) {
        return new Scene(id, rowVersion, chapterId, orderIndex, title, narration, durationSeconds);
    }

    public Long getChapterId() { return chapterId; }
    public int getOrderIndex() { return orderIndex; }
    public String getTitle() { return title; }
    public String getNarration() { return narration; }
    public Integer getDurationSeconds() { return durationSeconds; }
}
