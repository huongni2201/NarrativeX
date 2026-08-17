package com.narrativex.backend.feature.storyboard.domain.entity;

import com.narrativex.backend.feature.common.domain.DomainEntity;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.ImageQualityTier;
import com.narrativex.backend.feature.storyboard.domain.enums.MotionAction;

public final class VisualBeat extends DomainEntity {
    private final Long sceneId;
    private final int orderIndex;
    private final String visualIntent;
    private final MotionAction motionAction;
    private final AspectRatio aspectRatioOverride;
    private final ImageQualityTier qualityTierOverride;

    public VisualBeat(Long sceneId, int orderIndex, String visualIntent) {
        this(null, 0L, sceneId, orderIndex, visualIntent, MotionAction.STILL, null, null);
    }

    private VisualBeat(Long id, long rowVersion, Long sceneId, int orderIndex, String visualIntent,
                       MotionAction motionAction, AspectRatio aspectRatioOverride,
                       ImageQualityTier qualityTierOverride) {
        super(id, rowVersion);
        if (sceneId == null || sceneId <= 0) throw new IllegalArgumentException("sceneId must be positive");
        if (orderIndex < 0) throw new IllegalArgumentException("orderIndex must not be negative");
        if (visualIntent == null || visualIntent.isBlank()) throw new IllegalArgumentException("visualIntent must not be blank");
        if (motionAction == null) throw new IllegalArgumentException("motionAction must not be null");
        this.sceneId = sceneId;
        this.orderIndex = orderIndex;
        this.visualIntent = visualIntent;
        this.motionAction = motionAction;
        this.aspectRatioOverride = aspectRatioOverride;
        this.qualityTierOverride = qualityTierOverride;
    }

    public static VisualBeat rehydrate(Long id, long rowVersion, Long sceneId, int orderIndex,
                                       String visualIntent, MotionAction motionAction,
                                       AspectRatio aspectRatioOverride, ImageQualityTier qualityTierOverride) {
        return new VisualBeat(id, rowVersion, sceneId, orderIndex, visualIntent, motionAction,
            aspectRatioOverride, qualityTierOverride);
    }

    public Long getSceneId() { return sceneId; }
    public int getOrderIndex() { return orderIndex; }
    public String getVisualIntent() { return visualIntent; }
    public MotionAction getMotionAction() { return motionAction; }
    public AspectRatio getAspectRatioOverride() { return aspectRatioOverride; }
    public ImageQualityTier getQualityTierOverride() { return qualityTierOverride; }
}
