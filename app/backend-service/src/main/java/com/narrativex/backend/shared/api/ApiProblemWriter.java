package com.narrativex.backend.shared.api;

import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;

public final class ApiProblemWriter {

    private ApiProblemWriter() {
    }

    public static void write(HttpServletResponse response, ObjectMapper objectMapper,
                             HttpStatus status, ProblemDetail problem) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(problem));
    }
}
