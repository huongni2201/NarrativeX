package com.narrativex.backend.feature.character.application.command;

import java.util.UUID;

public record CreateCharacterVersionCommand(UUID characterId, String bible, String visualPrompt) {}
