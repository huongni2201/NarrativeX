package com.narrativex.backend.feature.storyboard.api.request;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AttachVisualBeatPreviewMediaRequest(@NotNull UUID mediaAssetId) {}
