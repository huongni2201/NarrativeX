package com.narrativex.backend.modules.character.infrastructure.persistence.entity;

import com.narrativex.backend.modules.character.domain.aggregate.OutfitVersion;
import com.narrativex.backend.modules.character.domain.aggregate.OutfitVersionStatus;
import com.narrativex.backend.shared.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "outfit_versions", uniqueConstraints = @UniqueConstraint(
    name = "uk_outfit_versions_character_version", columnNames = {"character_id", "version_number"}))
public class OutfitVersionJpaEntity extends JpaAuditedEntity {
    @Column(name = "character_id", nullable = false)
    private Long characterId;
    @Column(name = "version_number", nullable = false)
    private int versionNumber;
    @Column(name = "name", nullable = false, length = 160)
    private String name;
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
    @Column(name = "prompt", columnDefinition = "TEXT")
    private String prompt;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private OutfitVersionStatus status;

    protected OutfitVersionJpaEntity() {
    }

    public OutfitVersionJpaEntity(OutfitVersion outfitVersion) {
        apply(outfitVersion);
    }

    public void apply(OutfitVersion outfitVersion) {
        characterId = outfitVersion.getCharacterId();
        versionNumber = outfitVersion.getVersionNumber();
        name = outfitVersion.getName();
        description = outfitVersion.getDescription();
        prompt = outfitVersion.getPrompt();
        status = outfitVersion.getStatus();
    }

    public Long getCharacterId() { return characterId; }
    public int getVersionNumber() { return versionNumber; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getPrompt() { return prompt; }
    public OutfitVersionStatus getStatus() { return status; }
}
