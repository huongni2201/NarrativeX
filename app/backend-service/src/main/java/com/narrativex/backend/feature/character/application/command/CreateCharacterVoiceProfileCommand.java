package com.narrativex.backend.feature.character.application.command;

import java.util.UUID;

public record CreateCharacterVoiceProfileCommand(
    UUID characterId,
    long expectedRowVersion,
    String language,
    String accent,
    String voiceDescription,
    String deliveryBaseline) {}
