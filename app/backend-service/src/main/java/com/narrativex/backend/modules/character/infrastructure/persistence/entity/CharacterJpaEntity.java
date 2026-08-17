package com.narrativex.backend.modules.character.infrastructure.persistence.entity;

import com.narrativex.backend.modules.character.domain.aggregate.Character;
import com.narrativex.backend.modules.character.domain.aggregate.enums.CharacterStatus;
import com.narrativex.backend.shared.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "characters", indexes = @Index(name = "idx_characters_owner_status", columnList = "owner_id,status"))
public class CharacterJpaEntity extends JpaAuditedEntity {
    @Column(name = "owner_id", nullable = false, length = 128)
    private String ownerId;

    @Column(name = "workspace_id", length = 128)
    private String workspaceId;

    @Column(name = "canonical_name", nullable = false, length = 160)
    private String canonicalName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "aliases", nullable = false, columnDefinition = "jsonb")
    private List<String> aliases = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private CharacterStatus status;

    protected CharacterJpaEntity() {
    }

    public CharacterJpaEntity(Character character) {
        apply(character);
    }

    public void apply(Character character) {
        ownerId = character.getOwnerId();
        workspaceId = character.getWorkspaceId();
        canonicalName = character.getCanonicalName();
        aliases = new ArrayList<>(character.getAliases());
        status = character.getStatus();
    }

    public String getOwnerId() { return ownerId; }
    public String getWorkspaceId() { return workspaceId; }
    public String getCanonicalName() { return canonicalName; }
    public List<String> getAliases() { return aliases; }
    public CharacterStatus getStatus() { return status; }
}
