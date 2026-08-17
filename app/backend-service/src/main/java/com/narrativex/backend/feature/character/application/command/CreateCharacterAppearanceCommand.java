package com.narrativex.backend.feature.character.application.command;

public record CreateCharacterAppearanceCommand(Long characterId, Long projectId, String timelineKey,
                                                String ageState, String hairstyle, String injury,
                                                String wardrobeContext, String appearancePrompt,
                                                Long outfitVersionId, String ownerId) {
}
