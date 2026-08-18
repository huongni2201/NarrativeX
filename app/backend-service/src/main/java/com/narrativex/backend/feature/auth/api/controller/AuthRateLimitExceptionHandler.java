package com.narrativex.backend.feature.auth.api.controller;

import com.narrativex.backend.feature.auth.application.exception.AuthRateLimitExceededException;
import com.narrativex.backend.feature.common.api.CorrelationIdFilter;
import com.narrativex.backend.feature.common.api.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = PasswordAuthController.class)
public class AuthRateLimitExceptionHandler {

  @ExceptionHandler(AuthRateLimitExceededException.class)
  public ResponseEntity<ErrorResponse> handleRateLimit(
      AuthRateLimitExceededException exception, HttpServletRequest request) {
    ErrorResponse body =
        ErrorResponse.of(
            HttpStatus.TOO_MANY_REQUESTS.value(),
            "AUTH_RATE_LIMITED",
            exception.getMessage(),
            request.getRequestURI(),
            CorrelationIdFilter.correlationId(request));

    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
        .header(HttpHeaders.RETRY_AFTER, Long.toString(exception.retryAfterSeconds()))
        .body(body);
  }
}
