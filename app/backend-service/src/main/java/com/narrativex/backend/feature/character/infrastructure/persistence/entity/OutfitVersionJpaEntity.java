package com.narrativex.backend.feature.character.infrastructure.persistence.entity;

import com.narrativex.backend.feature.character.domain.entity.OutfitVersion;
import com.narrativex.backend.feature.character.domain.enums.OutfitVersionStatus;
import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
    name = "outfit_versions",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_outfit_versions_character_version",
            columnNames = {"character_id", "version_number"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
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


  public void apply(OutfitVersion v) {
    characterId = v.getCharacterId();
    versionNumber = v.getVersionNumber();
    name = v.getName();
    description = v.getDescription();
    prompt = v.getPrompt();
    status = v.getStatus();
  }
}
