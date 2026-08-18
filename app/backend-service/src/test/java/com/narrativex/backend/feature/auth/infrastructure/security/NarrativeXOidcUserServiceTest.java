package com.narrativex.backend.feature.auth.infrastructure.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.infrastructure.persistence.entity.AuthUserJpaEntity;
import com.narrativex.backend.feature.auth.infrastructure.persistence.repository.AuthUserJpaRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

@ExtendWith(MockitoExtension.class)
class NarrativeXOidcUserServiceTest {
  @Mock private AuthUserJpaRepository repository;
  @Mock private OAuth2UserService<OidcUserRequest, OidcUser> delegate;
  @Mock private OidcUserRequest request;
  @Mock private OidcUser oidcUser;

  private NarrativeXOidcUserService service;

  @BeforeEach
  void setUp() {
    service = new NarrativeXOidcUserService(repository, delegate);
  }

  @Test
  void verifiedGoogleEmailLinksExistingPasswordAccount() {
    AuthUserJpaEntity existing = existingAccount(null, true);
    stubGoogleUser("google-subject", "Owner@example.com");
    when(repository.findByGoogleSubject("google-subject")).thenReturn(Optional.empty());
    when(repository.findByEmailIgnoreCase("owner@example.com")).thenReturn(Optional.of(existing));
    when(repository.save(existing)).thenReturn(existing);

    OidcUser result = service.loadUser(request);

    assertNotNull(result);
    assertEquals("google-subject", existing.getGoogleSubject());
    assertEquals("Google Owner", existing.getDisplayName());
    verify(repository).save(existing);
  }

  @Test
  void existingAccountLinkedToDifferentGoogleSubjectIsRejected() {
    AuthUserJpaEntity existing = existingAccount("another-google-subject", true);
    stubGoogleUser("new-google-subject", "owner@example.com");
    when(repository.findByGoogleSubject("new-google-subject")).thenReturn(Optional.empty());
    when(repository.findByEmailIgnoreCase("owner@example.com")).thenReturn(Optional.of(existing));

    assertThrows(OAuth2AuthenticationException.class, () -> service.loadUser(request));
  }

  @Test
  void disabledExistingAccountIsNotLinked() {
    AuthUserJpaEntity existing = existingAccount(null, false);
    stubGoogleUser("google-subject", "owner@example.com");
    when(repository.findByGoogleSubject("google-subject")).thenReturn(Optional.empty());
    when(repository.findByEmailIgnoreCase("owner@example.com")).thenReturn(Optional.of(existing));

    assertThrows(OAuth2AuthenticationException.class, () -> service.loadUser(request));
  }

  private void stubGoogleUser(String subject, String email) {
    when(delegate.loadUser(request)).thenReturn(oidcUser);
    when(oidcUser.getEmailVerified()).thenReturn(true);
    when(oidcUser.getEmail()).thenReturn(email);
    when(oidcUser.getSubject()).thenReturn(subject);
    when(oidcUser.getFullName()).thenReturn("Google Owner");
    when(oidcUser.getGivenName()).thenReturn("Owner");
    when(oidcUser.getPicture()).thenReturn("https://example.com/avatar.png");
  }

  private static AuthUserJpaEntity existingAccount(String googleSubject, boolean enabled) {
    Instant now = Instant.now();
    return AuthUserJpaEntity.builder()
        .id("existing-user")
        .email("owner@example.com")
        .displayName("Existing Owner")
        .passwordHash("{bcrypt}hash")
        .googleSubject(googleSubject)
        .enabled(enabled)
        .createdAt(now)
        .updatedAt(now)
        .build();
  }
}
