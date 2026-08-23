package com.narrativex.backend.feature.character.application.command;

import java.util.UUID;

public record CreateCharacterAppearanceCommand(
    UUID characterId,
    UUID projectId,
    String timelineKey,
    String ageState,
    String hairstyle,
    String injury,
    String wardrobeContext,
    String appearancePrompt,
    UUID outfitVersionId,
    String ownerId) {}
