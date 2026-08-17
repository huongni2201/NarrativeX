package com.narrativex.backend.shared.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/** Resolves the caller without allowing a client header to impersonate an OIDC user. */
@Component
public class CurrentUserId {

    private final boolean oidcEnabled;
    private final String localUserId;

    public CurrentUserId(
        @Value("${narrativex.security.oidc-enabled:false}") boolean oidcEnabled,
        @Value("${narrativex.security.local-user-id:local-dev-user}") String localUserId
    ) {
        this.oidcEnabled = oidcEnabled;
        this.localUserId = localUserId;
    }

    public String resolve(String requestedHeader) {
        if (!oidcEnabled) {
            return requestedHeader == null || requestedHeader.isBlank() ? localUserId : requestedHeader;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
            || authentication instanceof AnonymousAuthenticationToken
            || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new IllegalArgumentException("Authenticated user is required");
        }
        return authentication.getName();
    }
}
