package com.narrativex.backend.feature.character.application.command;

import java.util.UUID;

public record CreateOutfitVersionCommand(
    UUID characterId, String name, String description, String prompt, String ownerId) {}
