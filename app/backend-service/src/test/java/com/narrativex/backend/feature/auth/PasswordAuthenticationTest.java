package com.narrativex.backend.feature.auth;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(
    properties = {
      "narrativex.security.oidc-enabled=false",
      "narrativex.security.local-dev-identity-enabled=false"
    })
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PasswordAuthenticationTest {
  @Autowired private MockMvc mockMvc;

  @Test
  void registrationCreatesARealAuthenticatedSession() throws Exception {
    MvcResult registration =
        mockMvc
            .perform(
                post("/api/auth/register")
                    .with(csrf())
                    .contentType("application/json")
                    .content(
                        """
                        {
                          "displayName": "Narrative User",
                          "email": "narrative.user@example.com",
                          "password": "correct-horse-battery-staple"
                        }
                        """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.id").isNotEmpty())
            .andExpect(jsonPath("$.data.displayName").value("Narrative User"))
            .andExpect(jsonPath("$.data.email").value("narrative.user@example.com"))
            .andReturn();

    MockHttpSession session = (MockHttpSession) registration.getRequest().getSession(false);
    mockMvc
        .perform(get("/api/auth/me").session(session))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.email").value("narrative.user@example.com"));
  }

  @Test
  void invalidPasswordDoesNotAuthenticate() throws Exception {
    mockMvc
        .perform(
            post("/api/auth/login")
                .with(csrf())
                .contentType("application/json")
                .content(
                    """
                    {
                      "email": "missing@example.com",
                      "password": "definitely-wrong"
                    }
                    """))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }
}
