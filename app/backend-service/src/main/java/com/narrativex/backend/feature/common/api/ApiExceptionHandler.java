package com.narrativex.backend.feature.common.api;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;
import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import com.narrativex.backend.feature.common.exception.FeatureNotAvailableException;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.sql.SQLException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Slf4j
@RestControllerAdvice
public class ApiExceptionHandler {
  private static final String UNIQUE_VIOLATION_SQL_STATE = "23505";

  @ExceptionHandler(DomainValidationException.class)
  ResponseEntity<ErrorResponse> handleDomainValidation(
      DomainValidationException exception, HttpServletRequest request) {
    return error(
        HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, exception.getMessage(), request);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<ErrorResponse> handleIllegalArgument(
      IllegalArgumentException exception, HttpServletRequest request) {
    log.warn(
        "Illegal argument at API boundary correlationId={} method={} path={} exceptionType={} message={}",
        CorrelationIdFilter.correlationId(request),
        request.getMethod(),
        request.getRequestURI(),
        exception.getClass().getSimpleName(),
        exception.getMessage());
    return error(
        HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "The request is invalid.", request);
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<ErrorResponse> handleValidation(
      MethodArgumentNotValidException exception, HttpServletRequest request) {
    List<FieldViolation> violations =
        exception.getBindingResult().getFieldErrors().stream()
            .map(
                fieldError ->
                    new FieldViolation(
                        fieldError.getField(),
                        fieldError.getCode(),
                        "validation." + fieldError.getField() + "." + fieldError.getCode(),
                        fieldError.getDefaultMessage()))
            .toList();
    return error(
        HttpStatus.BAD_REQUEST,
        ApiErrorCode.VALIDATION_FAILED,
        "Request validation failed.",
        request,
        violations);
  }

  @ExceptionHandler(ConstraintViolationException.class)
  ResponseEntity<ErrorResponse> handleConstraintViolation(
      ConstraintViolationException exception, HttpServletRequest request) {
    return error(
        HttpStatus.BAD_REQUEST,
        ApiErrorCode.VALIDATION_FAILED,
        "Request validation failed.",
        request);
  }

  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    MethodArgumentTypeMismatchException.class,
    MissingServletRequestParameterException.class
  })
  ResponseEntity<ErrorResponse> handleMalformedRequest(
      Exception exception, HttpServletRequest request) {
    return error(
        HttpStatus.BAD_REQUEST, ApiErrorCode.INVALID_REQUEST, "The request is invalid.", request);
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

  @ExceptionHandler(FeatureNotAvailableException.class)
  ResponseEntity<ErrorResponse> handleFeatureNotAvailable(
      FeatureNotAvailableException exception, HttpServletRequest request) {
    return error(
        HttpStatus.SERVICE_UNAVAILABLE,
        ApiErrorCode.FEATURE_NOT_AVAILABLE,
        exception.getMessage(),
        request);
  }

  @ExceptionHandler(DomainConflictException.class)
  ResponseEntity<ErrorResponse> handleDomainConflict(
      DomainConflictException exception, HttpServletRequest request) {
    ApiErrorCode code = ApiErrorCode.RESOURCE_CONFLICT;
    if (exception
        instanceof
        com.narrativex.backend.feature.generation.domain.exception
                .GenerationAdmissionDeniedException
            admission) {
      try {
        code = ApiErrorCode.valueOf(admission.getCode());
      } catch (IllegalArgumentException ignored) {
        // Keep the safe conflict code for unknown admission reasons.
      }
    } else if (exception
        instanceof
        com.narrativex.backend.feature.storyboard.domain.exception.ContentVariantNotReadyException) {
      code = ApiErrorCode.CONTENT_VARIANT_NOT_READY;
    }
    return error(HttpStatus.CONFLICT, code, exception.getMessage(), request);
  }

  @ExceptionHandler(ResourceConflictException.class)
  ResponseEntity<ErrorResponse> handleConflict(
      ResourceConflictException exception, HttpServletRequest request) {
    return conflict(request);
  }

  @ExceptionHandler(OptimisticLockingFailureException.class)
  ResponseEntity<ErrorResponse> handleOptimisticConflict(
      RuntimeException exception, HttpServletRequest request) {
    return conflict(request);
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<ErrorResponse> handleDataIntegrityViolation(
      DataIntegrityViolationException exception, HttpServletRequest request) {
    if (hasSqlState(exception, UNIQUE_VIOLATION_SQL_STATE)) {
      log.warn(
          "Unique constraint conflict at API boundary correlationId={} method={} path={}",
          CorrelationIdFilter.correlationId(request),
          request.getMethod(),
          request.getRequestURI());
      return conflict(request);
    }

    String correlationId = CorrelationIdFilter.correlationId(request);
    log.error(
        "Unexpected data integrity violation at API boundary correlationId={} method={} path={}",
        correlationId,
        request.getMethod(),
        request.getRequestURI(),
        exception);
    return error(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ApiErrorCode.INTERNAL_ERROR,
        "An unexpected error occurred.",
        request,
        correlationId);
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
    String correlationId = CorrelationIdFilter.correlationId(request);
    log.error(
        "Unhandled exception at API boundary correlationId={} method={} path={}",
        correlationId,
        request.getMethod(),
        request.getRequestURI(),
        exception);
    return error(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ApiErrorCode.INTERNAL_ERROR,
        "An unexpected error occurred.",
        request,
        correlationId);
  }

  private static boolean hasSqlState(Throwable throwable, String sqlState) {
    Throwable current = throwable;
    while (current != null) {
      if (current instanceof SQLException sqlException
          && sqlState.equals(sqlException.getSQLState())) {
        return true;
      }
      current = current.getCause();
    }
    return false;
  }

  private ResponseEntity<ErrorResponse> conflict(HttpServletRequest request) {
    return error(
        HttpStatus.CONFLICT,
        ApiErrorCode.RESOURCE_CONFLICT,
        "The resource changed or conflicts with the requested operation.",
        request);
  }

  private ResponseEntity<ErrorResponse> error(
      HttpStatus status, ApiErrorCode code, String message, HttpServletRequest request) {
    return error(status, code, message, request, CorrelationIdFilter.correlationId(request));
  }

  private ResponseEntity<ErrorResponse> error(
      HttpStatus status,
      ApiErrorCode code,
      String message,
      HttpServletRequest request,
      String correlationId) {
    return ResponseEntity.status(status)
        .body(
            ErrorResponse.of(
                status.value(), code.name(), message, request.getRequestURI(), correlationId));
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
