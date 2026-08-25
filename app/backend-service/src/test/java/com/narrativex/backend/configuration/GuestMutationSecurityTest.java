package com.narrativex.backend.configuration;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "narrativex.security.local-dev-identity-enabled=false")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GuestMutationSecurityTest {
  @Autowired private MockMvc mockMvc;

  @Test
  @WithMockUser(username = "guest-test", authorities = "ROLE_GUEST")
  void guestCannotCreateProject() throws Exception {
    assertAuthenticationRequired(
        post("/api/v1/projects")
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"));
  }

  @Test
  @WithMockUser(username = "guest-test", authorities = "ROLE_GUEST")
  void guestCannotCreateChapter() throws Exception {
    assertAuthenticationRequired(
        post("/api/v1/projects/00000000-0000-0000-0000-000000000001/chapters")
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"));
  }

  @Test
  @WithMockUser(username = "guest-test", authorities = "ROLE_GUEST")
  void guestCannotRegisterOrEditDurableContent() throws Exception {
    assertAuthenticationRequired(
        post("/api/v1/assets/local")
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"));
    assertAuthenticationRequired(
        put("/api/v1/projects/00000000-0000-0000-0000-000000000001/chapters/00000000-0000-0000-0000-000000000002")
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"));
    assertAuthenticationRequired(
        patch("/api/v1/projects/00000000-0000-0000-0000-000000000001")
            .with(csrf())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"));
    assertAuthenticationRequired(
        delete("/api/v1/assets/00000000-0000-0000-0000-000000000003").with(csrf()));
  }

  private void assertAuthenticationRequired(
      org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request)
      throws Exception {
    mockMvc
        .perform(request)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
  }
}
