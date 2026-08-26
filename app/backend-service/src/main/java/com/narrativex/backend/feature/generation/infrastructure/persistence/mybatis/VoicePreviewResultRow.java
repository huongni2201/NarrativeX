package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class VoicePreviewResultRow {
  private String storageKey;
  private String contentType;
  private long durationMs;
}
