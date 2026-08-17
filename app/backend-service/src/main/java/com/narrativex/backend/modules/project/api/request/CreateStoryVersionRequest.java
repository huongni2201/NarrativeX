package com.narrativex.backend.modules.project.api.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateStoryVersionRequest(
    @NotBlank String content,
    @Size(max = 16) String sourceLanguage,
    @AssertTrue(message = "rightsAttestationAccepted must be true before story analysis")
    boolean rightsAttestationAccepted,
    @Size(max = 64) String rightsPolicyVersion,
    @Size(max = 64) String rightsBasis
) {
}
