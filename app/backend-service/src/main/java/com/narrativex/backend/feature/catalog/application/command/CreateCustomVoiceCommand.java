package com.narrativex.backend.feature.catalog.application.command;

import java.util.UUID;

public record CreateCustomVoiceCommand(
    String name, String language, String gender, String description, UUID referenceAssetId) {}
