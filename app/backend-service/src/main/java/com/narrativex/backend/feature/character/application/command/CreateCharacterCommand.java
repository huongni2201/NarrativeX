package com.narrativex.backend.feature.character.application.command;

import java.util.List;

public record CreateCharacterCommand(String workspaceId, String canonicalName, List<String> aliases, String ownerId) {
}
