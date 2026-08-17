package com.narrativex.backend.modules.auth.infrastructure.security;

import com.narrativex.backend.modules.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.modules.auth.application.port.in.CurrentUserProfile;
import com.narrativex.backend.modules.auth.application.response.CurrentUserResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

/** Spring Security adapter for the application-owned current-user ports. */
@Component
public class SecurityContextCurrentUser implements CurrentUserId, CurrentUserProfile {

    private final boolean oidcEnabled;
    private final String localUserId;

    public SecurityContextCurrentUser(
        @Value("${narrativex.security.oidc-enabled:false}") boolean oidcEnabled,
        @Value("${narrativex.security.local-user-id:local-dev-user}") String localUserId
    ) {
        this.oidcEnabled = oidcEnabled;
        this.localUserId = localUserId;
    }

    @Override
    public String resolve(String requestedHeader) {
        if (!oidcEnabled) {
            return requestedHeader == null || requestedHeader.isBlank() ? localUserId : requestedHeader;
        }
        return authenticated().getName();
    }

    @Override
    public CurrentUserResponse current() {
        String id = resolve(null);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof OidcUser oidcUser) {
            return new CurrentUserResponse(id,
                firstNonBlank(oidcUser.getFullName(), oidcUser.getGivenName(), oidcUser.getEmail(), id),
                oidcUser.getEmail(), oidcUser.getPicture());
        }
        return new CurrentUserResponse(id, id, null, null);
    }

    private Authentication authenticated() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
            || authentication instanceof AnonymousAuthenticationToken
            || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new IllegalArgumentException("Authenticated user is required");
        }
        return authentication;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
