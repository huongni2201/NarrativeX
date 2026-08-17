package com.narrativex.backend.modules.project.infrastructure.persistence.entity;

import com.narrativex.backend.modules.project.domain.model.ModerationDecision;
import com.narrativex.backend.modules.project.domain.model.StoryVersion;
import com.narrativex.backend.modules.project.domain.model.StoryVersionStatus;
import com.narrativex.backend.shared.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

@Entity
@Table(name = "story_versions", uniqueConstraints = @UniqueConstraint(
    name = "uk_story_versions_project_version", columnNames = {"project_id", "version_number"}))
public class StoryVersionJpaEntity extends JpaAuditedEntity {

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "version_number", nullable = false)
    private int versionNumber;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "source_language", nullable = false, length = 16)
    private String sourceLanguage;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private StoryVersionStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "moderation_decision", nullable = false, length = 16)
    private ModerationDecision moderationDecision;

    @Column(name = "rights_attested", nullable = false)
    private boolean rightsAttested;

    @Column(name = "rights_policy_version", nullable = false, length = 64)
    private String rightsPolicyVersion;

    @Column(name = "rights_basis", nullable = false, length = 64)
    private String rightsBasis;

    @Column(name = "rights_attested_at")
    private Instant rightsAttestedAt;

    @Column(name = "rights_attested_by", length = 128)
    private String rightsAttestedBy;

    protected StoryVersionJpaEntity() {
    }

    public StoryVersionJpaEntity(StoryVersion storyVersion) {
        apply(storyVersion);
    }

    public void apply(StoryVersion storyVersion) {
        projectId = storyVersion.getProjectId();
        versionNumber = storyVersion.getVersionNumber();
        content = storyVersion.getContent();
        sourceLanguage = storyVersion.getSourceLanguage();
        status = storyVersion.getStatus();
        moderationDecision = storyVersion.getModerationDecision();
        rightsAttested = storyVersion.isRightsAttested();
        rightsPolicyVersion = storyVersion.getRightsPolicyVersion();
        rightsBasis = storyVersion.getRightsBasis();
        rightsAttestedAt = storyVersion.getRightsAttestedAt();
        rightsAttestedBy = storyVersion.getRightsAttestedBy();
    }

    public Long getProjectId() { return projectId; }
    public int getVersionNumber() { return versionNumber; }
    public String getContent() { return content; }
    public String getSourceLanguage() { return sourceLanguage; }
    public StoryVersionStatus getStatus() { return status; }
    public ModerationDecision getModerationDecision() { return moderationDecision; }
    public boolean isRightsAttested() { return rightsAttested; }
    public String getRightsPolicyVersion() { return rightsPolicyVersion; }
    public String getRightsBasis() { return rightsBasis; }
    public Instant getRightsAttestedAt() { return rightsAttestedAt; }
    public String getRightsAttestedBy() { return rightsAttestedBy; }
}
