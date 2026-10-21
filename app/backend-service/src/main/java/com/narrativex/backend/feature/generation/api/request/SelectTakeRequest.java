package com.narrativex.backend.feature.generation.api.request;

import com.narrativex.backend.feature.generation.domain.value.TakeContentReviewChecklist;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record SelectTakeRequest(
    @NotNull(message = "takeId must not be null") UUID takeId,
    @Min(value = 0, message = "sourceInMs must not be negative") long sourceInMs,
    @Min(value = 1, message = "sourceOutMs must be positive") long sourceOutMs,
    @NotNull(message = "expectedRowVersion must not be null")
        @Min(value = 0, message = "expectedRowVersion must not be negative")
        Long expectedRowVersion,
    @NotNull(message = "contentReview must not be null")
        TakeContentReviewChecklist contentReview) {}
