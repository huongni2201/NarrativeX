package com.narrativex.backend.modules.character.infrastructure.persistence.entity;

import com.narrativex.backend.modules.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.modules.character.domain.aggregate.ProjectCharacterStatus;
import com.narrativex.backend.shared.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "project_characters", uniqueConstraints = @UniqueConstraint(
    name = "uk_project_characters_project_character", columnNames = {"project_id", "character_id"}))
public class ProjectCharacterJpaEntity extends JpaAuditedEntity {
    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "character_id", nullable = false)
    private Long characterId;

    @Column(name = "role", nullable = false, length = 64)
    private String role;

    @Column(name = "importance", nullable = false)
    private int importance;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "project_aliases", nullable = false, columnDefinition = "jsonb")
    private List<String> projectAliases = new ArrayList<>();

    @Column(name = "story_metadata", columnDefinition = "TEXT")
    private String storyMetadata;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "groups_json", nullable = false, columnDefinition = "jsonb")
    private List<String> groups = new ArrayList<>();

    @Column(name = "pinned_character_version_id")
    private Long pinnedCharacterVersionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private ProjectCharacterStatus status;

    protected ProjectCharacterJpaEntity() {
    }

    public ProjectCharacterJpaEntity(ProjectCharacter assignment) {
        apply(assignment);
    }

    public void apply(ProjectCharacter assignment) {
        projectId = assignment.getProjectId();
        characterId = assignment.getCharacterId();
        role = assignment.getRole();
        importance = assignment.getImportance();
        projectAliases = new ArrayList<>(assignment.getProjectAliases());
        storyMetadata = assignment.getStoryMetadata();
        groups = new ArrayList<>(assignment.getGroups());
        pinnedCharacterVersionId = assignment.getPinnedCharacterVersionId();
        status = assignment.getStatus();
    }

    public Long getProjectId() { return projectId; }
    public Long getCharacterId() { return characterId; }
    public String getRole() { return role; }
    public int getImportance() { return importance; }
    public List<String> getProjectAliases() { return projectAliases; }
    public String getStoryMetadata() { return storyMetadata; }
    public List<String> getGroups() { return groups; }
    public Long getPinnedCharacterVersionId() { return pinnedCharacterVersionId; }
    public ProjectCharacterStatus getStatus() { return status; }
}
