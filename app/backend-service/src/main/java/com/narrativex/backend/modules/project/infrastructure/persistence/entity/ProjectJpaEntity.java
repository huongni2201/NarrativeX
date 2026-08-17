package com.narrativex.backend.modules.project.infrastructure.persistence.entity;

import com.narrativex.backend.modules.project.domain.aggregate.AspectRatio;
import com.narrativex.backend.modules.project.domain.aggregate.ImageQualityTier;
import com.narrativex.backend.modules.project.domain.aggregate.Project;
import com.narrativex.backend.modules.project.domain.aggregate.ProjectStatus;
import com.narrativex.backend.shared.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "projects", indexes = @Index(name = "idx_projects_owner_status", columnList = "owner_id,status"))
public class ProjectJpaEntity extends JpaAuditedEntity {

    @Column(name = "name", nullable = false, length = 160)
    private String name;

    @Column(name = "owner_id", nullable = false, length = 128)
    private String ownerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ProjectStatus status;

    @Column(name = "source_language", nullable = false, length = 16)
    private String sourceLanguage;

    @Column(name = "narration_language", nullable = false, length = 16)
    private String narrationLanguage;

    @Column(name = "metadata_language", nullable = false, length = 16)
    private String metadataLanguage;

    @Enumerated(EnumType.STRING)
    @Column(name = "image_aspect_ratio", nullable = false, length = 16)
    private AspectRatio imageAspectRatio;

    @Enumerated(EnumType.STRING)
    @Column(name = "image_quality_tier", nullable = false, length = 16)
    private ImageQualityTier imageQualityTier;

    @Column(name = "archived_at")
    private Instant archivedAt;

    protected ProjectJpaEntity() {
    }

    public ProjectJpaEntity(Project project) {
        apply(project);
    }

    public void apply(Project project) {
        name = project.getName();
        ownerId = project.getOwnerId();
        status = project.getStatus();
        sourceLanguage = project.getSourceLanguage();
        narrationLanguage = project.getNarrationLanguage();
        metadataLanguage = project.getMetadataLanguage();
        imageAspectRatio = project.getImageAspectRatio();
        imageQualityTier = project.getImageQualityTier();
        archivedAt = project.getArchivedAt();
    }

    public String getName() { return name; }
    public String getOwnerId() { return ownerId; }
    public ProjectStatus getStatus() { return status; }
    public String getSourceLanguage() { return sourceLanguage; }
    public String getNarrationLanguage() { return narrationLanguage; }
    public String getMetadataLanguage() { return metadataLanguage; }
    public AspectRatio getImageAspectRatio() { return imageAspectRatio; }
    public ImageQualityTier getImageQualityTier() { return imageQualityTier; }
    public Instant getArchivedAt() { return archivedAt; }
}
