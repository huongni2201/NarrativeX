package com.narrativex.backend.modules.common.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import com.narrativex.backend.modules.common.exception.ResourceConflictException;
import com.narrativex.backend.modules.common.exception.ResourceNotFoundException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;

class ApiExceptionHandlerTest {
    static class RequestPayload { public String getName() { return ""; } }
    private final ApiExceptionHandler handler = new ApiExceptionHandler();
    private MockHttpServletRequest request;
    @BeforeEach void setUp() { request = new MockHttpServletRequest("POST", "/api/v1/projects"); request.setAttribute(CorrelationIdFilter.REQUEST_ATTRIBUTE, "corr-test-123"); }
    @Test void notFoundUsesErrorResponseContract() { ErrorResponse error=body(handler.handleNotFound(new ResourceNotFoundException("secret story"),request)); assertEquals(404,error.status());assertEquals("RESOURCE_NOT_FOUND",error.code());assertEquals("corr-test-123",error.correlationId());assertFalse(error.success()); }
    @Test void conflictUses409() { ErrorResponse error=body(handler.handleConflict(new ResourceConflictException("internal version"),request));assertEquals(409,error.status());assertEquals("RESOURCE_CONFLICT",error.code()); }
    @Test void securityExceptionsUseExpectedStatusesAndCodes() { ErrorResponse forbidden=body(handler.handleAccessDenied(new AccessDeniedException("internal detail"),request));ErrorResponse unauthorized=body(handler.handleUnauthenticated(new BadCredentialsException("internal detail"),request));assertEquals(403,forbidden.status());assertEquals("FORBIDDEN",forbidden.code());assertEquals(401,unauthorized.status());assertEquals("UNAUTHORIZED",unauthorized.code()); }
    @Test void unexpectedFailureIsRedacted() { ErrorResponse error=body(handler.handleUnexpected(new RuntimeException("SQL password=hidden"),request));assertEquals(500,error.status());assertEquals("INTERNAL_ERROR",error.code());assertFalse(error.message().contains("SQL"));assertNotNull(error.timestamp()); }
    @Test void validationProducesStructuredErrors() throws Exception { var binding=new org.springframework.validation.BeanPropertyBindingResult(new RequestPayload(),"request");binding.rejectValue("name","NotBlank","must not be blank");var exception=new MethodArgumentNotValidException(new org.springframework.core.MethodParameter(ApiExceptionHandlerTest.class.getDeclaredMethods()[0],-1),binding);ErrorResponse error=body(handler.handleValidation(exception,request));assertEquals(400,error.status());assertEquals(List.of(new FieldViolation("name","NotBlank","validation.name.NotBlank","must not be blank")),error.errors()); }
    private static ErrorResponse body(ResponseEntity<ErrorResponse> response) { assertEquals(HttpStatus.valueOf(response.getBody().status()),response.getStatusCode());return response.getBody(); }
}
