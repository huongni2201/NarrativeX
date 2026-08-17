package com.narrativex.backend.shared.api;

/** Session identity exposed to the browser; provider tokens never leave Spring Security. */
public record CurrentUserResponse(
    String id,
    String displayName,
    String email,
    String avatarUrl
) {
}
