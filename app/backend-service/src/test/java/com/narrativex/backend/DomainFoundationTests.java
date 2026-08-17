package com.narrativex.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.auth.infrastructure.security.SecurityContextCurrentUser;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class DomainFoundationTests {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void aspectRatioUsesStableUserFacingCode() {
        assertEquals(AspectRatio.RATIO_9_16, AspectRatio.fromCode("9:16"));
        assertThrows(IllegalArgumentException.class, () -> AspectRatio.fromCode("2:1"));
    }

    @Test
    void storyVersionDoesNotInventRightsAttestation() {
        StoryVersion story = StoryVersion.create(1L, 1, "text", "en-US", false,
            "rights-v1.7", "USER_ATTESTED_RIGHTS_OR_LICENSE", "owner");
        assertFalse(story.isRightsAttested());
    }

    @Test
    void oidcIdentityWinsOverClientHeader() {
        SecurityContextHolder.getContext().setAuthentication(
            new TestingAuthenticationToken("oidc-subject", "credentials", "ROLE_USER"));
        assertEquals("oidc-subject", new SecurityContextCurrentUser(true, "local-user").resolve("attacker"));
    }
}
