package com.narrativex.backend.modules.storyboard.domain.aggregate;

import com.narrativex.backend.modules.project.domain.aggregate.AspectRatio;
import com.narrativex.backend.modules.project.domain.aggregate.ImageQualityTier;
import com.narrativex.backend.shared.domain.DomainEntity;
import java.util.Objects;

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
        this.sceneId = Objects.requireNonNull(sceneId, "sceneId");
        this.orderIndex = orderIndex;
        this.visualIntent = Objects.requireNonNull(visualIntent, "visualIntent");
        this.motionAction = Objects.requireNonNull(motionAction, "motionAction");
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
