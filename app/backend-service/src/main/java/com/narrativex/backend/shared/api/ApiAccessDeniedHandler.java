package com.narrativex.backend.shared.api;

import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

@Component
public class ApiAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    public ApiAccessDeniedHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException exception) throws IOException, ServletException {
        ApiErrorWriter.write(response, objectMapper, HttpStatus.FORBIDDEN,
            ErrorResponse.of(HttpStatus.FORBIDDEN.value(), ApiErrorCode.FORBIDDEN.name(),
                "Access denied.", request.getRequestURI(),
                CorrelationIdFilter.correlationId(request)));
    }
}
