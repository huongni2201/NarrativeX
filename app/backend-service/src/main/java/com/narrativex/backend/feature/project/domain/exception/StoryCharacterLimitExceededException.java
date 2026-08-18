package com.narrativex.backend.feature.project.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;

public class StoryCharacterLimitExceededException extends DomainValidationException {
  public StoryCharacterLimitExceededException(int actual, int maximum) {
    super("Story contains " + actual + " Unicode characters; maximum allowed is " + maximum + ".");
  }
}
