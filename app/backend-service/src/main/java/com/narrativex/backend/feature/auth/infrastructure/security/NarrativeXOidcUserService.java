package com.narrativex.backend.feature.auth.infrastructure.security;

import com.narrativex.backend.feature.auth.application.service.RegisterAuthAccountService;
import com.narrativex.backend.feature.common.application.port.out.UserPlanAssignmentProvisioner;
import com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis.AuthUserMapper;
import com.narrativex.backend.feature.auth.infrastructure.persistence.mybatis.AuthUserRow;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NarrativeXOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {
  private final OAuth2UserService<OidcUserRequest, OidcUser> delegate;
  private final AuthUserMapper mapper;
  private final UserPlanAssignmentProvisioner userPlanAssignmentProvisioner;

  public NarrativeXOidcUserService(
      AuthUserMapper mapper,
      @Qualifier("narrativeXOidcDelegate") OAuth2UserService<OidcUserRequest, OidcUser> delegate,
      UserPlanAssignmentProvisioner userPlanAssignmentProvisioner) {
    this.mapper = mapper;
    this.delegate = delegate;
    this.userPlanAssignmentProvisioner = userPlanAssignmentProvisioner;
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

    AuthUserRow account = mapper.findByGoogleSubject(subject);
    if (account == null) {
      AuthUserRow existingEmailAccount = mapper.findByEmail(email);
      if (existingEmailAccount != null) {
        if (!existingEmailAccount.isEnabled()) {
          throw invalidUserInfo("The NarrativeX account is disabled.");
        }
        String linkedSubject = existingEmailAccount.getGoogleSubject();
        if (linkedSubject != null && !linkedSubject.equals(subject)) {
          throw invalidUserInfo(
              "This NarrativeX account is already linked to another Google account.");
        }
        existingEmailAccount.linkGoogle(subject, displayName, avatarUrl);
        mapper.updateGoogleLink(existingEmailAccount);
        account = existingEmailAccount;
      } else {
        Instant now = Instant.now();
        account =
            AuthUserRow.builder()
                    .id(UUID.randomUUID().toString())
                    .email(email)
                    .displayName(displayName)
                    .avatarUrl(avatarUrl)
                    .googleSubject(subject)
                    .enabled(true)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
        mapper.insert(account);
      }
    } else {
      if (!account.isEnabled()) {
        throw invalidUserInfo("The NarrativeX account is disabled.");
      }
      account.linkGoogle(subject, displayName, avatarUrl);
      mapper.updateGoogleLink(account);
    }

    userPlanAssignmentProvisioner.ensureDefaultAssignment(account.getId());

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
