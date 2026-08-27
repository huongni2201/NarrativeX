package com.narrativex.backend.feature.auth.infrastructure.configuration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;

class GoogleOidcClientConfigurationTest {
  private final GoogleOidcClientConfiguration configuration = new GoogleOidcClientConfiguration();

  @Test
  void usesConfiguredPublicOriginForGoogleCallback() {
    ClientRegistrationRepository repository =
        configuration.clientRegistrationRepository("client-id", "client-secret", "https://narrativex.cloud/");

    assertEquals(
        "https://narrativex.cloud/login/oauth2/code/{registrationId}",
        repository.findByRegistrationId("google").getRedirectUri());
  }

  @Test
  void keepsDynamicLocalCallbackWhenPublicOriginIsNotConfigured() {
    ClientRegistrationRepository repository =
        configuration.clientRegistrationRepository("client-id", "client-secret", "");

    assertEquals(
        "{baseUrl}/login/oauth2/code/{registrationId}",
        repository.findByRegistrationId("google").getRedirectUri());
  }

  @Test
  void rejectsPublicBaseUrlWithPath() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            configuration.clientRegistrationRepository(
                "client-id", "client-secret", "https://narrativex.cloud/oauth"));
  }
}
