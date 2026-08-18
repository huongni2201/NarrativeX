package com.narrativex.backend.feature.character.application.command;

public record CreateOutfitVersionCommand(
    Long characterId, String name, String description, String prompt, String ownerId) {}
