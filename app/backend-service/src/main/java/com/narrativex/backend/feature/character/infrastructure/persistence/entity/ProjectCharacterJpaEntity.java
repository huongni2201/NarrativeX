package com.narrativex.backend.feature.character.infrastructure.persistence.entity;

import com.narrativex.backend.feature.character.domain.aggregate.ProjectCharacter;
import com.narrativex.backend.feature.character.domain.enums.ProjectCharacterStatus;
import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity @Table(name="project_characters",uniqueConstraints=@UniqueConstraint(name="uk_project_characters_project_character",columnNames={"project_id","character_id"}))
public class ProjectCharacterJpaEntity extends JpaAuditedEntity {
    @Column(name="project_id",nullable=false) private Long projectId; @Column(name="character_id",nullable=false) private Long characterId; @Column(name="role",nullable=false,length=64) private String role; @Column(name="importance",nullable=false) private int importance;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="project_aliases",nullable=false,columnDefinition="jsonb") private List<String> projectAliases=new ArrayList<>(); @Column(name="story_metadata",columnDefinition="TEXT") private String storyMetadata; @JdbcTypeCode(SqlTypes.JSON) @Column(name="groups_json",nullable=false,columnDefinition="jsonb") private List<String> groups=new ArrayList<>(); @Column(name="pinned_character_version_id") private Long pinnedCharacterVersionId; @Enumerated(EnumType.STRING) @Column(name="status",nullable=false,length=24) private ProjectCharacterStatus status;
    protected ProjectCharacterJpaEntity() {} public ProjectCharacterJpaEntity(ProjectCharacter a){apply(a);} public void apply(ProjectCharacter a){projectId=a.getProjectId();characterId=a.getCharacterId();role=a.getRole();importance=a.getImportance();projectAliases=new ArrayList<>(a.getProjectAliases());storyMetadata=a.getStoryMetadata();groups=new ArrayList<>(a.getGroups());pinnedCharacterVersionId=a.getPinnedCharacterVersionId();status=a.getStatus();}
    public Long getProjectId(){return projectId;} public Long getCharacterId(){return characterId;} public String getRole(){return role;} public int getImportance(){return importance;} public List<String> getProjectAliases(){return projectAliases;} public String getStoryMetadata(){return storyMetadata;} public List<String> getGroups(){return groups;} public Long getPinnedCharacterVersionId(){return pinnedCharacterVersionId;} public ProjectCharacterStatus getStatus(){return status;}
}
