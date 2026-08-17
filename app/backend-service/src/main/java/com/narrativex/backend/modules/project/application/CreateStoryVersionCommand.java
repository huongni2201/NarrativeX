package com.narrativex.backend.modules.project.application;

public record CreateStoryVersionCommand(
    String content,
    String sourceLanguage,
    boolean rightsAttestationAccepted,
    String rightsPolicyVersion,
    String rightsBasis
    ) {
}
