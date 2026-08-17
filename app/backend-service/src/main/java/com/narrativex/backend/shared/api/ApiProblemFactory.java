package com.narrativex.backend.shared.api;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

public final class ApiProblemFactory {

    private ApiProblemFactory() {
    }

    public static ProblemDetail create(HttpStatus status, ApiErrorCode code, String messageKey,
                                       String detail, HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        String path = request.getRequestURI();
        problem.setProperty("code", code.name());
        problem.setProperty("messageKey", messageKey);
        problem.setProperty("path", path);
        problem.setProperty("correlationId", CorrelationIdFilter.correlationId(request));
        problem.setInstance(java.net.URI.create(path));
        return problem;
    }

    public static void addViolations(ProblemDetail problem, List<FieldViolation> violations) {
        problem.setProperty("violations", violations);
    }
}
