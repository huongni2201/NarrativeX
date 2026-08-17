package com.narrativex.backend.feature.common.api;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import tools.jackson.databind.ObjectMapper;

public final class ApiErrorWriter {
    private ApiErrorWriter() {}

    public static void write(HttpServletResponse response, ObjectMapper objectMapper,
            HttpStatus status, ErrorResponse error) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(error));
    }
}
