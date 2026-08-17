package com.narrativex.backend.shared.api;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class ApiSecurityErrorHandlerTest {

    @Autowired
    private ApiAuthenticationEntryPoint authenticationEntryPoint;

    @Autowired
    private ApiAccessDeniedHandler accessDeniedHandler;

    @Test
    void authenticationEntryPointWrites401ErrorResponseJson() throws Exception {
        MockHttpServletRequest request = request("/api/v1/projects");
        MockHttpServletResponse response = new MockHttpServletResponse();

        authenticationEntryPoint.commence(request, response, new BadCredentialsException("secret"));

        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getContentAsString())
            .contains("\"success\":false", "\"status\":401", "\"code\":\"UNAUTHORIZED\"",
                "\"path\":\"/api/v1/projects\"", "\"correlationId\":\"corr-security\"");
    }

    @Test
    void accessDeniedHandlerWrites403ErrorResponseJson() throws Exception {
        MockHttpServletRequest request = request("/api/v1/projects");
        MockHttpServletResponse response = new MockHttpServletResponse();

        accessDeniedHandler.handle(request, response, new AccessDeniedException("secret"));

        assertThat(response.getStatus()).isEqualTo(HttpServletResponse.SC_FORBIDDEN);
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getContentAsString())
            .contains("\"success\":false", "\"status\":403", "\"code\":\"FORBIDDEN\"",
                "\"path\":\"/api/v1/projects\"", "\"correlationId\":\"corr-security\"");
    }

    private static MockHttpServletRequest request(String path) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setAttribute(CorrelationIdFilter.REQUEST_ATTRIBUTE, "corr-security");
        return request;
    }
}
