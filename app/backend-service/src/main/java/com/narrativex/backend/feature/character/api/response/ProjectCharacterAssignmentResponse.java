package com.narrativex.backend.feature.character.api.response;

import java.util.UUID;

public record ProjectCharacterAssignmentResponse(
    UUID assignmentId, UUID characterId, UUID projectId) {}
