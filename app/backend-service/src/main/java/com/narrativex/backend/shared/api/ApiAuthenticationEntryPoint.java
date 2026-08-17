package com.narrativex.backend.shared.api;

import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

@Component
public class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public ApiAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException exception) throws IOException, ServletException {
        ApiErrorWriter.write(response, objectMapper, HttpStatus.UNAUTHORIZED,
            ErrorResponse.of(HttpStatus.UNAUTHORIZED.value(), ApiErrorCode.UNAUTHORIZED.name(),
                "Authentication is required.", request.getRequestURI(),
                CorrelationIdFilter.correlationId(request)));
    }
}
