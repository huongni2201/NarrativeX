package com.narrativex.backend.feature.project.application.command;

public record CreateStoryVersionCommand(
    Long projectId,
    String content,
    String sourceLanguage,
    boolean rightsAttestationAccepted,
    String rightsPolicyVersion,
    String rightsBasis,
    String ownerId
) {
}
