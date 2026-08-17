package com.narrativex.backend.feature.character.infrastructure.persistence.entity;

import com.narrativex.backend.feature.character.domain.entity.CharacterAppearance;
import com.narrativex.backend.feature.common.infrastructure.persistence.JpaAuditedEntity;
import jakarta.persistence.*;

@Entity @Table(name="character_appearances")
public class CharacterAppearanceJpaEntity extends JpaAuditedEntity {
    @Column(name="character_id",nullable=false) private Long characterId; @Column(name="project_id") private Long projectId; @Column(name="timeline_key",nullable=false,length=128) private String timelineKey;
    @Column(name="age_state",columnDefinition="TEXT") private String ageState; @Column(name="hairstyle",columnDefinition="TEXT") private String hairstyle; @Column(name="injury",columnDefinition="TEXT") private String injury; @Column(name="wardrobe_context",columnDefinition="TEXT") private String wardrobeContext; @Column(name="appearance_prompt",columnDefinition="TEXT") private String appearancePrompt; @Column(name="outfit_version_id") private Long outfitVersionId;
    protected CharacterAppearanceJpaEntity() {} public CharacterAppearanceJpaEntity(CharacterAppearance a){apply(a);} public void apply(CharacterAppearance a){characterId=a.getCharacterId();projectId=a.getProjectId();timelineKey=a.getTimelineKey();ageState=a.getAgeState();hairstyle=a.getHairstyle();injury=a.getInjury();wardrobeContext=a.getWardrobeContext();appearancePrompt=a.getAppearancePrompt();outfitVersionId=a.getOutfitVersionId();}
    public Long getCharacterId(){return characterId;} public Long getProjectId(){return projectId;} public String getTimelineKey(){return timelineKey;} public String getAgeState(){return ageState;} public String getHairstyle(){return hairstyle;} public String getInjury(){return injury;} public String getWardrobeContext(){return wardrobeContext;} public String getAppearancePrompt(){return appearancePrompt;} public Long getOutfitVersionId(){return outfitVersionId;}
}
