package com.narrativex.backend.modules.storyboard.domain;

import com.narrativex.backend.modules.project.domain.AspectRatio;
import com.narrativex.backend.modules.project.domain.ImageQualityTier;
import com.narrativex.backend.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "visual_beats", uniqueConstraints = @UniqueConstraint(
    name = "uk_visual_beats_scene_order", columnNames = {"scene_id", "order_index"}))
public class VisualBeat extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scene_id", nullable = false, foreignKey = @ForeignKey(name = "fk_visual_beats_scene"))
    private Scene scene;

    @Column(name = "order_index", nullable = false)
    private int orderIndex;

    @Column(name = "visual_intent", nullable = false, columnDefinition = "TEXT")
    private String visualIntent;

    @Enumerated(EnumType.STRING)
    @Column(name = "motion_action", nullable = false, length = 24)
    private MotionAction motionAction = MotionAction.STILL;

    @Enumerated(EnumType.STRING)
    @Column(name = "aspect_ratio_override", length = 16)
    private AspectRatio aspectRatioOverride;

    @Enumerated(EnumType.STRING)
    @Column(name = "quality_tier_override", length = 16)
    private ImageQualityTier qualityTierOverride;

    protected VisualBeat() {
    }

    public VisualBeat(Scene scene, int orderIndex, String visualIntent) {
        this.scene = scene;
        this.orderIndex = orderIndex;
        this.visualIntent = visualIntent;
    }

    public Scene getScene() {
        return scene;
    }

    public int getOrderIndex() {
        return orderIndex;
    }

    public String getVisualIntent() {
        return visualIntent;
    }

    public MotionAction getMotionAction() {
        return motionAction;
    }
}
