package com.narrativex.backend.configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.narrativex.backend.modules.auth.infrastructure.configuration.NonLocalSecurityConfigurationGuard;
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
    void nonLocalProfileRefusesToStartWithOidcDisabled() {
        new ApplicationContextRunner().withUserConfiguration(NonLocalSecurityConfigurationGuard.class)
            .withPropertyValues("spring.profiles.active=staging", "narrativex.security.oidc-enabled=false")
            .run(context -> assertThat(context.getStartupFailure()).hasRootCauseInstanceOf(IllegalStateException.class));
    }

    @Test
    void csrfEndpointReturnsSessionBoundTokenCookie() throws Exception {
        mockMvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andExpect(cookie().exists("XSRF-TOKEN"));
    }

    @Test
    void currentUserEndpointReturnsTheLocalServerIdentity() throws Exception {
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith("application/json"))
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.id").value("local-dev-user"))
            .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void stateChangingRequestWithoutCsrfTokenIsRejected() throws Exception {
        mockMvc.perform(post("/api/v1/projects").contentType("application/json").content("{}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void stateChangingRequestWithCsrfTokenReachesApplication() throws Exception {
        mockMvc.perform(post("/api/v1/projects").with(csrf()).contentType("application/json").content("{}"))
            .andExpect(status().isBadRequest());
    }
}
