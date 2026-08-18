package com.narrativex.backend.feature.auth.infrastructure.configuration;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration(proxyBeanMethods = false)
@Profile({"staging", "prod", "production"})
@ConditionalOnProperty(
    prefix = "narrativex.security",
    name = "oidc-enabled",
    havingValue = "false",
    matchIfMissing = true)
public class NonLocalSecurityConfigurationGuard {
  public NonLocalSecurityConfigurationGuard() {
    throw new IllegalStateException(
        "OIDC must be enabled before starting with the staging or production profile");
  }
}
