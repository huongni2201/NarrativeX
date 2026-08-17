package com.narrativex.backend.shared.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ProblemDetail;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.bind.MethodArgumentNotValidException;

import com.narrativex.backend.shared.exception.ResourceConflictException;
import com.narrativex.backend.shared.exception.ResourceNotFoundException;

class ApiExceptionHandlerTest {

    static class RequestPayload {
        public String getName() {
            return "";
        }
    }

    private final ApiExceptionHandler handler = new ApiExceptionHandler();
    private MockHttpServletRequest request;

    @BeforeEach
    void setUp() {
        request = new MockHttpServletRequest("POST", "/api/v1/projects");
        request.setAttribute(CorrelationIdFilter.REQUEST_ATTRIBUTE, "corr-test-123");
    }

    @Test
    void notFoundUsesStableProblemContract() {
        ProblemDetail problem = handler.handleNotFound(new ResourceNotFoundException("secret story"), request);

        assertEquals(404, problem.getStatus());
        assertEquals("RESOURCE_NOT_FOUND", problem.getProperties().get("code"));
        assertEquals("corr-test-123", problem.getProperties().get("correlationId"));
        assertEquals("/api/v1/projects", problem.getProperties().get("path"));
        assertFalse(problem.getDetail().contains("secret story"));
    }

    @Test
    void conflictUses409() {
        ProblemDetail problem = handler.handleConflict(new ResourceConflictException("internal version"), request);

        assertEquals(409, problem.getStatus());
        assertEquals("RESOURCE_CONFLICT", problem.getProperties().get("code"));
    }

    @Test
    void unexpectedFailureIsRedacted() {
        ProblemDetail problem = handler.handleUnexpected(new RuntimeException("SQL password=hidden"), request);

        assertEquals(500, problem.getStatus());
        assertEquals("INTERNAL_ERROR", problem.getProperties().get("code"));
        assertEquals("An unexpected error occurred.", problem.getDetail());
        assertFalse(problem.getDetail().contains("SQL"));
    }

    @Test
    void validationProducesStructuredViolations() {
        var binding = new org.springframework.validation.BeanPropertyBindingResult(new RequestPayload(), "request");
        binding.rejectValue("name", "NotBlank", "must not be blank");
        var exception = new MethodArgumentNotValidException(
                new org.springframework.core.MethodParameter(ApiExceptionHandlerTest.class.getDeclaredMethods()[0], -1),
                binding);

        ProblemDetail problem = handler.handleValidation(exception, request);

        assertEquals("VALIDATION_FAILED", problem.getProperties().get("code"));
        assertEquals(1, ((java.util.List<?>) problem.getProperties().get("violations")).size());
    }
}
