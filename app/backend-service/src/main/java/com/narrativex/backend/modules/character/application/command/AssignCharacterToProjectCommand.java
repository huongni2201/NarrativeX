package com.narrativex.backend.modules.character.application.command;

import java.util.List;

public record AssignCharacterToProjectCommand(Long projectId, Long characterId, String role, int importance,
                                               List<String> projectAliases, String storyMetadata,
                                               List<String> groups, Long pinnedCharacterVersionId,
                                               String ownerId) {
}
