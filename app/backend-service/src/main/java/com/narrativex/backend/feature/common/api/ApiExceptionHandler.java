package com.narrativex.backend.feature.common.api;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import jakarta.persistence.OptimisticLockException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(DomainValidationException.class)
  ResponseEntity<ErrorResponse> handleDomainValidation(
      DomainValidationException exception, HttpServletRequest request) {
    return error(
        HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, exception.getMessage(), request);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ErrorResponse> handleIllegalArgument(
      IllegalArgumentException exception, HttpServletRequest request) {
    return error(
        HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "The request is invalid.", request);
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<ErrorResponse> handleValidation(
      MethodArgumentNotValidException exception, HttpServletRequest request) {
    List<FieldViolation> violations =
        exception.getBindingResult().getFieldErrors().stream()
            .map(
                error ->
                    new FieldViolation(
                        error.getField(),
                        error.getCode(),
                        "validation." + error.getField() + "." + error.getCode(),
                        error.getDefaultMessage()))
            .toList();
    return error(
        HttpStatus.BAD_REQUEST,
        ApiErrorCode.VALIDATION_FAILED,
        "Request validation failed.",
        request,
        violations);
  }

  @ExceptionHandler(ResourceNotFoundException.class)
  ResponseEntity<ErrorResponse> handleNotFound(
      ResourceNotFoundException exception, HttpServletRequest request) {
    return error(
        HttpStatus.NOT_FOUND,
        ApiErrorCode.RESOURCE_NOT_FOUND,
        "The requested resource was not found.",
        request);
  }

  @ExceptionHandler(DomainConflictException.class)
  ResponseEntity<ErrorResponse> handleDomainConflict(
      DomainConflictException exception, HttpServletRequest request) {
    return error(
        HttpStatus.CONFLICT, ApiErrorCode.RESOURCE_CONFLICT, exception.getMessage(), request);
  }

  @ExceptionHandler(ResourceConflictException.class)
  ResponseEntity<ErrorResponse> handleConflict(
      ResourceConflictException exception, HttpServletRequest request) {
    return error(
        HttpStatus.CONFLICT,
        ApiErrorCode.RESOURCE_CONFLICT,
        "The resource changed or conflicts with the requested operation.",
        request);
  }

  @ExceptionHandler({OptimisticLockException.class, ObjectOptimisticLockingFailureException.class})
  ResponseEntity<ErrorResponse> handleOptimisticConflict(
      RuntimeException exception, HttpServletRequest request) {
    return error(
        HttpStatus.CONFLICT,
        ApiErrorCode.RESOURCE_CONFLICT,
        "The resource changed or conflicts with the requested operation.",
        request);
  }

  @ExceptionHandler(AccessDeniedException.class)
  ResponseEntity<ErrorResponse> handleAccessDenied(
      AccessDeniedException exception, HttpServletRequest request) {
    return error(HttpStatus.FORBIDDEN, ApiErrorCode.FORBIDDEN, "Access denied.", request);
  }

  @ExceptionHandler(AuthenticationException.class)
  ResponseEntity<ErrorResponse> handleUnauthenticated(
      AuthenticationException exception, HttpServletRequest request) {
    return error(
        HttpStatus.UNAUTHORIZED, ApiErrorCode.UNAUTHORIZED, "Authentication is required.", request);
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<ErrorResponse> handleUnexpected(Exception exception, HttpServletRequest request) {
    return error(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ApiErrorCode.INTERNAL_ERROR,
        "An unexpected error occurred.",
        request);
  }

  private ResponseEntity<ErrorResponse> error(
      HttpStatus status, ApiErrorCode code, String message, HttpServletRequest request) {
    return ResponseEntity.status(status)
        .body(
            ErrorResponse.of(
                status.value(),
                code.name(),
                message,
                request.getRequestURI(),
                CorrelationIdFilter.correlationId(request)));
  }

  private ResponseEntity<ErrorResponse> error(
      HttpStatus status,
      ApiErrorCode code,
      String message,
      HttpServletRequest request,
      List<FieldViolation> violations) {
    return ResponseEntity.status(status)
        .body(
            ErrorResponse.validation(
                status.value(),
                code.name(),
                message,
                request.getRequestURI(),
                CorrelationIdFilter.correlationId(request),
                violations));
  }
}
