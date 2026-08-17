package com.narrativex.backend.shared.api;

import com.narrativex.backend.shared.security.CurrentUserId;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Returns the server-authenticated browser session without trusting client identity headers. */
@RestController
@RequestMapping("/api/auth")
public class CurrentUserController {

    private final CurrentUserId currentUserId;

    public CurrentUserController(CurrentUserId currentUserId) {
        this.currentUserId = currentUserId;
    }

    @GetMapping("/me")
    public CurrentUserResponse me(Authentication authentication) {
        String id = currentUserId.resolve(null);
        if (authentication != null && authentication.getPrincipal() instanceof OidcUser oidcUser) {
            return new CurrentUserResponse(
                id,
                firstNonBlank(oidcUser.getFullName(), oidcUser.getGivenName(), oidcUser.getEmail(), id),
                oidcUser.getEmail(),
                oidcUser.getPicture()
            );
        }
        return new CurrentUserResponse(id, id, null, null);
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
