package com.narrativex.backend.feature.character.application.command;

import java.util.List;
import java.util.UUID;

public record AssignCharacterToProjectCommand(
    UUID projectId,
    UUID characterId,
    String role,
    int importance,
    List<String> projectAliases,
    String storyMetadata,
    List<String> groups,
    UUID pinnedCharacterVersionId) {}
