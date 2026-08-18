package com.narrativex.backend.feature.character.infrastructure.persistence.entity;

import com.narrativex.backend.feature.character.domain.aggregate.Character;
import com.narrativex.backend.feature.character.domain.enums.CharacterStatus;
import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
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
    name = "characters",
    indexes = @Index(name = "idx_characters_owner_status", columnList = "owner_id,status"))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CharacterJpaEntity extends JpaAuditedEntity {
  @Column(name = "owner_id", nullable = false, length = 128)
  private String ownerId;

  @Column(name = "workspace_id", length = 128)
  private String workspaceId;

  @Column(name = "canonical_name", nullable = false, length = 160)
  private String canonicalName;

  @Builder.Default
  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "aliases", nullable = false, columnDefinition = "jsonb")
  private List<String> aliases = new ArrayList<>();

  @Enumerated(EnumType.STRING)
  @Column(name = "status", nullable = false, length = 24)
  private CharacterStatus status;

  public void apply(Character c) {
    ownerId = c.getOwnerId();
    workspaceId = c.getWorkspaceId();
    canonicalName = c.getCanonicalName();
    aliases = new ArrayList<>(c.getAliases());
    status = c.getStatus();
  }
}
