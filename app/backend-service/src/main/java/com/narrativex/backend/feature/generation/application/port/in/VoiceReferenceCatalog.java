package com.narrativex.backend.feature.generation.application.port.in;

import java.util.List;
import java.util.UUID;

public interface VoiceReferenceCatalog {
  VoiceReferenceView get(UUID id);

  List<VoiceReferenceView> list();

  record VoiceReferenceView(
      UUID id,
      String originalFilename,
      String contentType,
      long sizeBytes,
      String sha256,
      String status) {}
}
