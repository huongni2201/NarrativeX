package com.narrativex.backend.feature.character.application.command;

public record CreateCharacterVersionCommand(
    Long characterId, String bible, String visualPrompt, String ownerId) {}
