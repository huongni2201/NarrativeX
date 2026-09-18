package com.narrativex.backend.feature.generation.application.model.analysis;

/**
 * Base exception for failures during chapter analysis.
 */
public class ChapterAnalysisException extends RuntimeException {
  private final boolean retryable;

  public ChapterAnalysisException(String message) {
    this(message, false, null);
  }

  public ChapterAnalysisException(String message, Throwable cause) {
    this(message, false, cause);
  }

  public ChapterAnalysisException(String message, boolean retryable) {
    this(message, retryable, null);
  }

  public ChapterAnalysisException(String message, boolean retryable, Throwable cause) {
    super(message, cause);
    this.retryable = retryable;
  }

  public boolean isRetryable() {
    return retryable;
  }

  public static class ContextTooLargeException extends ChapterAnalysisException {
    private final int tokenCount;
    private final int limit;

    public ContextTooLargeException(int tokenCount, int limit) {
      super("Chapter input token count (" + tokenCount + ") exceeds soft limit (" + limit + ")", false);
      this.tokenCount = tokenCount;
      this.limit = limit;
    }

    public int getTokenCount() {
      return tokenCount;
    }

    public int getLimit() {
      return limit;
    }
  }

  public static class RateLimitException extends ChapterAnalysisException {
    public RateLimitException(String message) {
      super(message, true);
    }

    public RateLimitException(String message, Throwable cause) {
      super(message, true, cause);
    }
  }

  public static class ProviderUnavailableException extends ChapterAnalysisException {
    public ProviderUnavailableException(String message) {
      super(message, true);
    }

    public ProviderUnavailableException(String message, Throwable cause) {
      super(message, true, cause);
    }
  }

  public static class ValidationException extends ChapterAnalysisException {
    public ValidationException(String message) {
      super(message, false);
    }

    public ValidationException(String message, Throwable cause) {
      super(message, false, cause);
    }
  }
}
