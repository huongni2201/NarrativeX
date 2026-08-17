package com.narrativex.backend.modules.project.domain;

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
import java.time.Instant;

@Entity
@Table(name = "story_versions", uniqueConstraints = @UniqueConstraint(
    name = "uk_story_versions_project_version", columnNames = {"project_id", "version_number"}))
public class StoryVersion extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false, foreignKey = @ForeignKey(name = "fk_story_versions_project"))
    private Project project;

    @Column(name = "version_number", nullable = false)
    private int versionNumber;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "source_language", nullable = false, length = 16)
    private String sourceLanguage;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private StoryVersionStatus status = StoryVersionStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(name = "moderation_decision", nullable = false, length = 16)
    private ModerationDecision moderationDecision = ModerationDecision.PENDING;

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

    protected StoryVersion() {
    }

    public StoryVersion(Project project, int versionNumber, String content, String sourceLanguage,
                        boolean rightsAttested, String rightsPolicyVersion, String rightsBasis,
                        String rightsAttestedBy) {
        this.project = project;
        this.versionNumber = versionNumber;
        this.content = content;
        this.sourceLanguage = sourceLanguage;
        this.rightsAttested = rightsAttested;
        this.rightsPolicyVersion = rightsPolicyVersion;
        this.rightsBasis = rightsBasis;
        this.rightsAttestedAt = rightsAttested ? Instant.now() : null;
        this.rightsAttestedBy = rightsAttestedBy;
    }

    public Project getProject() {
        return project;
    }

    public int getVersionNumber() {
        return versionNumber;
    }

    public String getContent() {
        return content;
    }

    public StoryVersionStatus getStatus() {
        return status;
    }

    public ModerationDecision getModerationDecision() {
        return moderationDecision;
    }

    public boolean isRightsAttested() {
        return rightsAttested;
    }

    public String getRightsPolicyVersion() {
        return rightsPolicyVersion;
    }

    public String getRightsBasis() {
        return rightsBasis;
    }

    public Instant getRightsAttestedAt() {
        return rightsAttestedAt;
    }

    public String getRightsAttestedBy() {
        return rightsAttestedBy;
    }

    public void activate() {
        status = StoryVersionStatus.ACTIVE;
    }
}
