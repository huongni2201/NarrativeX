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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class ApiAccessDeniedHandler implements AccessDeniedHandler {
  private final ObjectMapper objectMapper;

  @Override
  public void handle(
      HttpServletRequest request, HttpServletResponse response, AccessDeniedException exception)
      throws IOException, ServletException {
    ApiErrorWriter.write(
        response,
        objectMapper,
        HttpStatus.FORBIDDEN,
        ErrorResponse.of(
            HttpStatus.FORBIDDEN.value(),
            ApiErrorCode.FORBIDDEN.name(),
            "Access denied.",
            request.getRequestURI(),
            CorrelationIdFilter.correlationId(request)));
  }
}
