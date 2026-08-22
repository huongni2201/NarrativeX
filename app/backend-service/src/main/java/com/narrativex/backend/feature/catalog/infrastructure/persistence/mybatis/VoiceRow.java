package com.narrativex.backend.feature.catalog.infrastructure.persistence.mybatis;

import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VoiceRow {
  private String id;
  private String provider;
  private String name;
  private String language;
  private String gender;
  private String sampleUrl;
  private String metadataJson;
  private Instant updatedAt;
}
