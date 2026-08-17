package com.narrativex.backend.shared.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.persistence.OptimisticLockException;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.narrativex.backend.shared.exception.ResourceConflictException;
import com.narrativex.backend.shared.exception.ResourceNotFoundException;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    ProblemDetail handleIllegalArgument(IllegalArgumentException exception, HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "api.request.invalid",
                "The request is invalid.", request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleValidation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, ApiErrorCode.VALIDATION_FAILED,
                "api.validation.failed", "Request validation failed.", request);
        ApiProblemFactory.addViolations(problem, exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldViolation(error.getField(), error.getCode(),
                        "validation." + error.getField() + "." + error.getCode(), error.getDefaultMessage()))
                .toList());
        return problem;
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    ProblemDetail handleNotFound(ResourceNotFoundException exception, HttpServletRequest request) {
        return problem(HttpStatus.NOT_FOUND, ApiErrorCode.RESOURCE_NOT_FOUND, "api.resource.notFound",
                "The requested resource was not found.", request);
    }

    @ExceptionHandler(ResourceConflictException.class)
    ProblemDetail handleConflict(ResourceConflictException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, ApiErrorCode.RESOURCE_CONFLICT, "api.resource.conflict",
                "The resource changed or conflicts with the requested operation.", request);
    }

    @ExceptionHandler({ OptimisticLockException.class, ObjectOptimisticLockingFailureException.class })
    ProblemDetail handleOptimisticConflict(RuntimeException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, ApiErrorCode.RESOURCE_CONFLICT, "api.resource.conflict",
                "The resource changed or conflicts with the requested operation.", request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ProblemDetail handleAccessDenied(AccessDeniedException exception, HttpServletRequest request) {
        return problem(HttpStatus.FORBIDDEN, ApiErrorCode.ACCESS_DENIED, "api.auth.accessDenied",
                "Access to this resource is denied.", request);
    }

    @ExceptionHandler(AuthenticationException.class)
    ProblemDetail handleUnauthenticated(AuthenticationException exception, HttpServletRequest request) {
        return problem(HttpStatus.UNAUTHORIZED, ApiErrorCode.UNAUTHENTICATED, "api.auth.unauthenticated",
                "Authentication is required.", request);
    }

    @ExceptionHandler(Exception.class)
    ProblemDetail handleUnexpected(Exception exception, HttpServletRequest request) {
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, ApiErrorCode.INTERNAL_ERROR, "api.internal.error",
                "An unexpected error occurred.", request);
    }

    private ProblemDetail problem(HttpStatus status, ApiErrorCode code, String messageKey, String detail,
            HttpServletRequest request) {
        return ApiProblemFactory.create(status, code, messageKey, detail, request);
    }
}
