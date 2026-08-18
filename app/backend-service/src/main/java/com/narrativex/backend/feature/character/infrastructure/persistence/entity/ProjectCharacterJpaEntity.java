package com.narrativex.backend.feature.character.infrastructure.persistence.entity;

import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.feature.character.domain.enums.ProjectCharacterStatus;
import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(
    name = "project_characters",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_project_characters_project_character",
            columnNames = {"project_id", "character_id"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectCharacterJpaEntity extends JpaAuditedEntity {
  @Column(name = "project_id", nullable = false)
  private Long projectId;

  @Column(name = "character_id", nullable = false)
  private Long characterId;

  @Column(name = "role", nullable = false, length = 64)
  private String role;

  @Column(name = "importance", nullable = false)
  private int importance;

  @Builder.Default
  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "project_aliases", nullable = false, columnDefinition = "jsonb")
  private List<String> projectAliases = new ArrayList<>();

  @Column(name = "story_metadata", columnDefinition = "TEXT")
  private String storyMetadata;

  @Builder.Default
  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "groups_json", nullable = false, columnDefinition = "jsonb")
  private List<String> groups = new ArrayList<>();

  @Column(name = "pinned_character_version_id")
  private Long pinnedCharacterVersionId;

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 24)
  private ProjectCharacterStatus status;


  public void apply(ProjectCharacter a) {
    projectId = a.getProjectId();
    characterId = a.getCharacterId();
    role = a.getRole();
    importance = a.getImportance();
    projectAliases = new ArrayList<>(a.getProjectAliases());
    storyMetadata = a.getStoryMetadata();
    groups = new ArrayList<>(a.getGroups());
    pinnedCharacterVersionId = a.getPinnedCharacterVersionId();
    status = a.getStatus();
  }
}

