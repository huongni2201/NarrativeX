package com.narrativex.backend.modules.project.application.command;

public record CreateStoryVersionCommand(
    String content,
    String sourceLanguage,
    boolean rightsAttestationAccepted,
    String rightsPolicyVersion,
    String rightsBasis
) {
}
