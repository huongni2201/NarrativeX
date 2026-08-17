package com.narrativex.backend.modules.project.domain;

import com.narrativex.backend.shared.domain.AuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

@Entity
@Table(name = "projects", indexes = @Index(name = "idx_projects_owner_status", columnList = "owner_id,status"))
public class Project extends AuditedEntity {

    @NotBlank
    @Size(max = 160)
    @Column(name = "name", nullable = false, length = 160)
    private String name;

    @NotBlank
    @Size(max = 128)
    @Column(name = "owner_id", nullable = false, length = 128)
    private String ownerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ProjectStatus status = ProjectStatus.DRAFT;

    @Column(name = "source_language", nullable = false, length = 16)
    private String sourceLanguage = "vi-VN";

    @Column(name = "narration_language", nullable = false, length = 16)
    private String narrationLanguage = "vi-VN";

    @Column(name = "metadata_language", nullable = false, length = 16)
    private String metadataLanguage = "vi-VN";

    @Enumerated(EnumType.STRING)
    @Column(name = "image_aspect_ratio", nullable = false, length = 16)
    private AspectRatio imageAspectRatio = AspectRatio.RATIO_16_9;

    @Enumerated(EnumType.STRING)
    @Column(name = "image_quality_tier", nullable = false, length = 16)
    private ImageQualityTier imageQualityTier = ImageQualityTier.STANDARD;

    @Column(name = "archived_at")
    private Instant archivedAt;

    protected Project() {
    }

    public Project(String name, String ownerId) {
        this(name, ownerId, "vi-VN", "vi-VN", "vi-VN", AspectRatio.RATIO_16_9,
            ImageQualityTier.STANDARD);
    }

    public Project(String name, String ownerId, String sourceLanguage, String narrationLanguage,
                   String metadataLanguage, AspectRatio imageAspectRatio, ImageQualityTier imageQualityTier) {
        this.name = name;
        this.ownerId = ownerId;
        this.sourceLanguage = sourceLanguage;
        this.narrationLanguage = narrationLanguage;
        this.metadataLanguage = metadataLanguage;
        this.imageAspectRatio = imageAspectRatio;
        this.imageQualityTier = imageQualityTier;
    }

    public String getName() {
        return name;
    }

    public String getOwnerId() {
        return ownerId;
    }

    public ProjectStatus getStatus() {
        return status;
    }

    public String getSourceLanguage() {
        return sourceLanguage;
    }

    public String getNarrationLanguage() {
        return narrationLanguage;
    }

    public String getMetadataLanguage() {
        return metadataLanguage;
    }

    public AspectRatio getImageAspectRatio() {
        return imageAspectRatio;
    }

    public ImageQualityTier getImageQualityTier() {
        return imageQualityTier;
    }

    public Instant getArchivedAt() {
        return archivedAt;
    }

    public void archive() {
        status = ProjectStatus.ARCHIVED;
        archivedAt = Instant.now();
    }
}
