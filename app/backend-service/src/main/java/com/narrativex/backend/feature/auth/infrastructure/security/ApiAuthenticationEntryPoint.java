package com.narrativex.backend.feature.auth.infrastructure.security;

import com.narrativex.backend.feature.common.api.ApiErrorCode;
import com.narrativex.backend.feature.common.api.ApiErrorWriter;
import com.narrativex.backend.feature.common.api.CorrelationIdFilter;
import com.narrativex.backend.feature.common.api.ErrorResponse;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {
  private final ObjectMapper objectMapper;

  @Override
  public void commence(
      HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
      throws IOException, ServletException {
    ApiErrorWriter.write(
        response,
        objectMapper,
        HttpStatus.UNAUTHORIZED,
        ErrorResponse.of(
            HttpStatus.UNAUTHORIZED.value(),
            ApiErrorCode.UNAUTHORIZED.name(),
            "Authentication is required.",
            request.getRequestURI(),
            CorrelationIdFilter.correlationId(request)));
  }
}
