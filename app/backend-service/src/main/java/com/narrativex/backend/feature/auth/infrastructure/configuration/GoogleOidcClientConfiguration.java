package com.narrativex.backend.feature.auth.infrastructure.configuration;

import java.net.URI;
import java.net.URISyntaxException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;

@Configuration
@ConditionalOnProperty(prefix = "narrativex.security", name = "oidc-enabled", havingValue = "true")
public class GoogleOidcClientConfiguration {
  @Bean
  ClientRegistrationRepository clientRegistrationRepository(
      @Value("${narrativex.security.google.client-id:}") String clientId,
      @Value("${narrativex.security.google.client-secret:}") String clientSecret,
      @Value("${narrativex.security.public-base-url:}") String publicBaseUrl) {
    if (clientId.isBlank() || clientSecret.isBlank()) {
      throw new IllegalStateException(
          "Google OIDC is enabled but GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET is missing");
    }

    ClientRegistration google =
        ClientRegistration.withRegistrationId("google")
            .clientId(clientId)
            .clientSecret(clientSecret)
            .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .redirectUri(resolveRedirectUriTemplate(publicBaseUrl))
            .scope("openid", "profile", "email")
            .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
            .tokenUri("https://oauth2.googleapis.com/token")
            .userInfoUri("https://openidconnect.googleapis.com/v1/userinfo")
            .userNameAttributeName("sub")
            .jwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
            .clientName("Google")
            .build();
    return new InMemoryClientRegistrationRepository(google);
  }

  private static String resolveRedirectUriTemplate(String publicBaseUrl) {
    if (publicBaseUrl == null || publicBaseUrl.isBlank()) {
      return "{baseUrl}/login/oauth2/code/{registrationId}";
    }

    try {
      URI uri = new URI(publicBaseUrl.trim());
      if ((!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme()))
          || uri.getHost() == null
          || uri.getUserInfo() != null
          || uri.getQuery() != null
          || uri.getFragment() != null
          || (uri.getPath() != null && !uri.getPath().isEmpty() && !"/".equals(uri.getPath()))) {
        throw new IllegalArgumentException(
            "NARRATIVEX_PUBLIC_BASE_URL must be an HTTP(S) origin without a path, query, or fragment");
      }
      return uri.toString().replaceAll("/+$", "") + "/login/oauth2/code/{registrationId}";
    } catch (URISyntaxException exception) {
      throw new IllegalArgumentException(
          "NARRATIVEX_PUBLIC_BASE_URL must be a valid HTTP(S) origin", exception);
    }
  }
}
