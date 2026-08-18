package com.narrativex.backend.feature.project.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;

public class StoryTokenLimitExceededException extends DomainValidationException {
  public StoryTokenLimitExceededException(int estimated, int maximum) {
    super("Story is conservatively estimated at " + estimated + " input tokens; maximum allowed is " + maximum + ".");
  }
}
