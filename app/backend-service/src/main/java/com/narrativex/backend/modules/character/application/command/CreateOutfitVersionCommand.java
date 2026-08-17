package com.narrativex.backend.modules.character.application.command;

public record CreateOutfitVersionCommand(Long characterId, String name, String description, String prompt) {
}
