package com.narrativex.backend.feature.auth.infrastructure.configuration;

import java.util.Arrays;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(
    prefix = "narrativex.security",
    name = "oidc-enabled",
    havingValue = "false",
    matchIfMissing = true)
public class NonLocalSecurityConfigurationGuard {
  private static final Set<String> LOCAL_ONLY_PROFILES = Set.of("local", "test");

  public NonLocalSecurityConfigurationGuard(Environment environment) {
    String[] activeProfiles = environment.getActiveProfiles();
    boolean explicitlyLocalOrTest =
        activeProfiles.length > 0
            && Arrays.stream(activeProfiles).allMatch(LOCAL_ONLY_PROFILES::contains);

    if (!explicitlyLocalOrTest) {
      throw new IllegalStateException(
          "OIDC may only be disabled when every active Spring profile is explicitly local or test");
    }
  }
}
