package com.narrativex.backend.configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.narrativex.backend.feature.auth.infrastructure.configuration.NonLocalSecurityConfigurationGuard;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityConfigurationTest {
  @Autowired private MockMvc mockMvc;

  @Test
  void oidcDisabledFailsClosedWithoutAnExplicitLocalOrTestProfile() {
    assertStartupFails("narrativex.security.oidc-enabled=false");
    assertStartupFails("spring.profiles.active=prod", "narrativex.security.oidc-enabled=false");
    assertStartupFails("spring.profiles.active=production", "narrativex.security.oidc-enabled=false");
    assertStartupFails("spring.profiles.active=staging", "narrativex.security.oidc-enabled=false");
    assertStartupFails("spring.profiles.active=qa", "narrativex.security.oidc-enabled=false");
    assertStartupFails("spring.profiles.active=unexpected", "narrativex.security.oidc-enabled=false");
  }

  @Test
  void oidcDisabledStartsOnlyForExplicitLocalOrTestProfiles() {
    assertStartupSucceeds("spring.profiles.active=local", "narrativex.security.oidc-enabled=false");
    assertStartupSucceeds("spring.profiles.active=test", "narrativex.security.oidc-enabled=false");
    assertStartupSucceeds(
        "spring.profiles.active=local,test", "narrativex.security.oidc-enabled=false");
  }

  @Test
  void oidcEnabledDoesNotRequireAProfile() {
    assertStartupSucceeds("narrativex.security.oidc-enabled=true");
    assertStartupSucceeds("spring.profiles.active=production", "narrativex.security.oidc-enabled=true");
  }

  @Test
  void csrfEndpointReturnsSessionBoundTokenCookie() throws Exception {
    mockMvc
        .perform(get("/api/v1/auth/csrf"))
        .andExpect(status().isOk())
        .andExpect(cookie().exists("XSRF-TOKEN"));
  }

  @Test
  void currentUserEndpointReturnsTheLocalServerIdentity() throws Exception {
    mockMvc
        .perform(get("/api/auth/me"))
        .andExpect(status().isOk())
        .andExpect(content().contentTypeCompatibleWith("application/json"))
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.id").value("local-dev-user"))
        .andExpect(jsonPath("$.timestamp").exists());
  }

  @Test
  void stateChangingRequestWithoutCsrfTokenIsRejected() throws Exception {
    mockMvc
        .perform(post("/api/v1/projects").contentType("application/json").content("{}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  void stateChangingRequestWithCsrfTokenReachesApplication() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/projects").with(csrf()).contentType("application/json").content("{}"))
        .andExpect(status().isBadRequest());
  }

  private static void assertStartupFails(String... properties) {
    new ApplicationContextRunner()
        .withUserConfiguration(NonLocalSecurityConfigurationGuard.class)
        .withPropertyValues(properties)
        .run(
            context ->
                assertThat(context.getStartupFailure())
                    .hasRootCauseInstanceOf(IllegalStateException.class));
  }

  private static void assertStartupSucceeds(String... properties) {
    new ApplicationContextRunner()
        .withUserConfiguration(NonLocalSecurityConfigurationGuard.class)
        .withPropertyValues(properties)
        .run(context -> assertThat(context).hasNotFailed());
  }
}
