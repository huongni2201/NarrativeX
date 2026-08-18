package com.narrativex.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.narrativex.backend.feature.auth.infrastructure.security.SecurityContextCurrentUser;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.project.domain.enums.AspectRatio;
import com.narrativex.backend.feature.project.domain.enums.StoryVersionStatus;
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
  void storyVersionCanActivateWithoutRightsAttestation() {
    StoryVersion story = StoryVersion.create(1L, 1, "text", "en-US");

    story.activate();

    assertEquals(StoryVersionStatus.ACTIVE, story.getStatus());
  }

  @Test
  void identityComesFromSecurityContext() {
    SecurityContextHolder.getContext()
        .setAuthentication(
            new TestingAuthenticationToken("oidc-subject", "credentials", "ROLE_USER"));
    assertEquals("oidc-subject", new SecurityContextCurrentUser().get());
  }
}
