package com.narrativex.backend.feature.generation.application.command;

import java.util.UUID;

public record EstimateMediaJobCommand(UUID projectId, UUID chapterId, String qualityTier) {}
