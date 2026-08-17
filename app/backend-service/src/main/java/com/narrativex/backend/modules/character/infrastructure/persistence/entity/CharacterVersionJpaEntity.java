package com.narrativex.backend.modules.character.infrastructure.persistence.entity;

import com.narrativex.backend.modules.character.domain.aggregate.CharacterVersion;
import com.narrativex.backend.modules.character.domain.aggregate.enums.CharacterVersionStatus;
import com.narrativex.backend.shared.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "character_versions", uniqueConstraints = @UniqueConstraint(
    name = "uk_character_versions_character_version", columnNames = {"character_id", "version_number"}))
public class CharacterVersionJpaEntity extends JpaAuditedEntity {
    @Column(name = "character_id", nullable = false)
    private Long characterId;

    @Column(name = "version_number", nullable = false)
    private int versionNumber;

    @Column(name = "bible", nullable = false, columnDefinition = "TEXT")
    private String bible;

    @Column(name = "visual_prompt", nullable = false, columnDefinition = "TEXT")
    private String visualPrompt;

    @Column(name = "master_asset_id")
    private Long masterAssetId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "reference_asset_ids", nullable = false, columnDefinition = "jsonb")
    private List<Long> referenceAssetIds = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private CharacterVersionStatus status;

    @Column(name = "locked_at")
    private Instant lockedAt;

    @Column(name = "locked_by", length = 128)
    private String lockedBy;

    protected CharacterVersionJpaEntity() {
    }

    public CharacterVersionJpaEntity(CharacterVersion version) {
        apply(version);
    }

    public void apply(CharacterVersion version) {
        characterId = version.getCharacterId();
        versionNumber = version.getVersionNumber();
        bible = version.getBible();
        visualPrompt = version.getVisualPrompt();
        masterAssetId = version.getMasterAssetId();
        referenceAssetIds = new ArrayList<>(version.getReferenceAssetIds());
        status = version.getStatus();
        lockedAt = version.getLockedAt();
        lockedBy = version.getLockedBy();
    }

    public Long getCharacterId() { return characterId; }
    public int getVersionNumber() { return versionNumber; }
    public String getBible() { return bible; }
    public String getVisualPrompt() { return visualPrompt; }
    public Long getMasterAssetId() { return masterAssetId; }
    public List<Long> getReferenceAssetIds() { return referenceAssetIds; }
    public CharacterVersionStatus getStatus() { return status; }
    public Instant getLockedAt() { return lockedAt; }
    public String getLockedBy() { return lockedBy; }
}
