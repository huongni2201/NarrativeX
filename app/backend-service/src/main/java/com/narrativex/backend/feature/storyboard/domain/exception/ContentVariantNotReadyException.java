package com.narrativex.backend.feature.storyboard.domain.exception;

import com.narrativex.backend.feature.common.domain.exception.DomainConflictException;

/** Raised when the chapter has no ORIGINAL snapshot matching its current source hash. */
public final class ContentVariantNotReadyException extends DomainConflictException {
  public static final String CODE = "CONTENT_VARIANT_NOT_READY";

  public ContentVariantNotReadyException() {
    super(
        "The ORIGINAL content variant is missing or does not match the current chapter source.");
  }

  public String getCode() {
    return CODE;
  }
}
