package com.narrativex.backend.feature.character.infrastructure.persistence.entity;

import com.narrativex.backend.feature.character.domain.entity.CharacterVersion;
import com.narrativex.backend.feature.character.domain.enums.CharacterVersionStatus;
import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
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
    name = "character_versions",
    uniqueConstraints =
        @UniqueConstraint(
            name = "uk_character_versions_character_version",
            columnNames = {"character_id", "version_number"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
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

  @Builder.Default
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


  public void apply(CharacterVersion v) {
    characterId = v.getCharacterId();
    versionNumber = v.getVersionNumber();
    bible = v.getBible();
    visualPrompt = v.getVisualPrompt();
    masterAssetId = v.getMasterAssetId();
    referenceAssetIds = new ArrayList<>(v.getReferenceAssetIds());
    status = v.getStatus();
    lockedAt = v.getLockedAt();
    lockedBy = v.getLockedBy();
  }
}

