package com.narrativex.backend.feature.generation.api.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record PrepareStoryboardGenerationBatchRequest(
    @NotEmpty @Size(max = 500) List<UUID> beatIds, UUID expectedStoryboardRevisionId) {}
