package com.narrativex.backend.feature.auth.infrastructure.security;

import com.narrativex.backend.feature.auth.application.service.RegisterAuthAccountService;
import com.narrativex.backend.feature.auth.infrastructure.persistence.entity.AuthUserJpaEntity;
import com.narrativex.backend.feature.auth.infrastructure.persistence.repository.AuthUserJpaRepository;
import java.util.UUID;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NarrativeXOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {
  private final OidcUserService delegate = new OidcUserService();
  private final AuthUserJpaRepository repository;

  public NarrativeXOidcUserService(AuthUserJpaRepository repository) {
    this.repository = repository;
  }

  @Override
  @Transactional
  public OidcUser loadUser(OidcUserRequest request) throws OAuth2AuthenticationException {
    OidcUser oidcUser = delegate.loadUser(request);
    if (!Boolean.TRUE.equals(oidcUser.getEmailVerified())
        || oidcUser.getEmail() == null
        || oidcUser.getEmail().isBlank()) {
      throw invalidUserInfo("Google did not provide a verified email address.");
    }

    String subject = oidcUser.getSubject();
    String email = RegisterAuthAccountService.normalizeEmail(oidcUser.getEmail());
    String displayName = firstNonBlank(oidcUser.getFullName(), oidcUser.getGivenName(), email);
    String avatarUrl = oidcUser.getPicture();

    AuthUserJpaEntity account = repository.findByGoogleSubject(subject).orElse(null);
    if (account == null) {
      AuthUserJpaEntity existingEmailAccount = repository.findByEmailIgnoreCase(email).orElse(null);
      if (existingEmailAccount != null) {
        throw invalidUserInfo(
            "This email already belongs to a NarrativeX account. Sign in with that method first before linking Google.");
      }
      account =
          repository.save(
              new AuthUserJpaEntity(
                  UUID.randomUUID().toString(),
                  email,
                  displayName,
                  avatarUrl,
                  null,
                  subject,
                  true));
    } else {
      account.linkGoogle(subject, displayName, avatarUrl);
      account = repository.save(account);
    }

    if (!account.isEnabled()) {
      throw invalidUserInfo("The NarrativeX account is disabled.");
    }
    return new NarrativeXOidcUser(account.getId(), oidcUser);
  }

  private static OAuth2AuthenticationException invalidUserInfo(String description) {
    return new OAuth2AuthenticationException(new OAuth2Error("invalid_user_info"), description);
  }

  private static String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null && !value.isBlank()) {
        return value;
      }
    }
    return "NarrativeX user";
  }
}
