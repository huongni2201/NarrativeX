package com.narrativex.backend.modules.character.application.command;

public record ChangeCharacterVersionStatusCommand(Long characterVersionId, String actorId) {
}
