package com.narrativex.backend.modules.character.infrastructure.persistence.entity;

import com.narrativex.backend.modules.character.domain.entity.OutfitVersion;
import com.narrativex.backend.modules.character.domain.enums.OutfitVersionStatus;
import com.narrativex.backend.modules.common.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.*;

@Entity
@Table(name="outfit_versions",uniqueConstraints=@UniqueConstraint(name="uk_outfit_versions_character_version",columnNames={"character_id","version_number"}))
public class OutfitVersionJpaEntity extends JpaAuditedEntity {
    @Column(name="character_id",nullable=false) private Long characterId; @Column(name="version_number",nullable=false) private int versionNumber;
    @Column(name="name",nullable=false,length=160) private String name; @Column(name="description",columnDefinition="TEXT") private String description; @Column(name="prompt",columnDefinition="TEXT") private String prompt;
    @Enumerated(EnumType.STRING) @Column(name="status",nullable=false,length=24) private OutfitVersionStatus status;
    protected OutfitVersionJpaEntity() {} public OutfitVersionJpaEntity(OutfitVersion v){apply(v);} public void apply(OutfitVersion v){characterId=v.getCharacterId();versionNumber=v.getVersionNumber();name=v.getName();description=v.getDescription();prompt=v.getPrompt();status=v.getStatus();}
    public Long getCharacterId(){return characterId;} public int getVersionNumber(){return versionNumber;} public String getName(){return name;} public String getDescription(){return description;} public String getPrompt(){return prompt;} public OutfitVersionStatus getStatus(){return status;}
}
