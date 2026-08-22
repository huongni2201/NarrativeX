package com.narrativex.backend.feature.storyboard.infrastructure.persistence.mybatis;

import java.math.BigDecimal;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LanguageDetectionRow {
  private Long id;
  private Long contentVariantId;
  private String detectedLanguage;
  private BigDecimal confidence;
  private String detector;
  private String contentHash;
  private Instant detectedAt;
}
