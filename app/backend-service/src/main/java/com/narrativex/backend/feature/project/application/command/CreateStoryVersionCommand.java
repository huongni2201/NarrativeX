package com.narrativex.backend.feature.project.application.command;

import java.util.UUID;

public record CreateStoryVersionCommand(
    UUID projectId, String content, String sourceLanguage, String ownerId) {}
