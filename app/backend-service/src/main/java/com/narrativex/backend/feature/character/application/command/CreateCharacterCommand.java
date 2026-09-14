package com.narrativex.backend.feature.character.application.command;

import java.util.List;

public record CreateCharacterCommand(String canonicalName, List<String> aliases) {}
