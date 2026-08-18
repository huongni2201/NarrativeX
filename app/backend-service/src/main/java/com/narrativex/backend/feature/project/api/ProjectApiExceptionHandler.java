package com.narrativex.backend.feature.project.api;

import com.narrativex.backend.feature.common.api.ApiErrorCode;
import com.narrativex.backend.feature.common.api.CorrelationIdFilter;
import com.narrativex.backend.feature.common.api.ErrorResponse;
import com.narrativex.backend.feature.project.domain.exception.StoryCharacterLimitExceededException;
import com.narrativex.backend.feature.project.domain.exception.StoryTokenLimitExceededException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice
public class ProjectApiExceptionHandler {
  @ExceptionHandler(StoryCharacterLimitExceededException.class)
  ResponseEntity<ErrorResponse> handleStoryCharacterLimit(
      StoryCharacterLimitExceededException exception, HttpServletRequest request) {
    return badRequest(ApiErrorCode.STORY_CHARACTER_LIMIT_EXCEEDED, exception.getMessage(), request);
  }

  @ExceptionHandler(StoryTokenLimitExceededException.class)
  ResponseEntity<ErrorResponse> handleStoryTokenLimit(
      StoryTokenLimitExceededException exception, HttpServletRequest request) {
    return badRequest(ApiErrorCode.STORY_TOKEN_LIMIT_EXCEEDED, exception.getMessage(), request);
  }

  private static ResponseEntity<ErrorResponse> badRequest(
      ApiErrorCode code, String message, HttpServletRequest request) {
    return ResponseEntity.badRequest()
        .body(
            ErrorResponse.of(
                HttpStatus.BAD_REQUEST.value(),
                code.name(),
                message,
                request.getRequestURI(),
                CorrelationIdFilter.correlationId(request)));
  }
}
