package com.narrativex.backend.feature.catalog.application.usecase;

import com.narrativex.backend.feature.catalog.application.command.CreateCustomVoiceCommand;
import com.narrativex.backend.feature.catalog.application.port.out.CustomVoiceRepository;
import com.narrativex.backend.feature.catalog.application.query.VoiceView;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.in.VoiceReferenceCatalog;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Custom VieNeu voices are catalog rows bound to a validated reference recording. VieNeu keeps
 * enrolled voices in process memory only, so the backend catalog stays the source of truth and
 * every synthesis clones from the stored reference.
 */
@Service
@RequiredArgsConstructor
public class ManageCustomVoiceUseCase {
  public static final String ID_PREFIX = "custom-";

  private final CustomVoiceRepository repository;
  private final VoiceReferenceCatalog voiceReferences;
  private final ObjectMapper objectMapper;

  @Transactional
  public VoiceView create(CreateCustomVoiceCommand command) {
    var reference = voiceReferences.get(command.referenceAssetId());
    if (!"READY".equals(reference.status())) {
      throw new IllegalArgumentException("Voice reference asset must be READY");
    }

    String id = ID_PREFIX + UuidV7.random();
    String name = command.name().trim();
    String metadataJson = metadataJson(command, reference.originalFilename());
    if (!repository.insert(id, name, command.language(), command.gender(), metadataJson)) {
      throw new ResourceConflictException("A voice named '" + name + "' already exists");
    }
    return new VoiceView(
        id,
        "VIENEU",
        name,
        command.language(),
        command.gender(),
        null,
        metadataJson,
        Instant.now());
  }

  @Transactional
  public void delete(String voiceId) {
    if (voiceId == null || !voiceId.startsWith(ID_PREFIX) || !repository.disable(voiceId)) {
      throw new ResourceNotFoundException("Custom voice not found");
    }
  }

  private String metadataJson(CreateCustomVoiceCommand command, String referenceFilename) {
    Map<String, Object> metadata = new LinkedHashMap<>();
    metadata.put("style", "custom");
    metadata.put("local", true);
    metadata.put("custom", true);
    metadata.put("model", "vieneu-v3-turbo");
    metadata.put("supportsSpeakingRate", true);
    metadata.put("supportsVoiceClone", true);
    metadata.put("supportsBatch", false);
    metadata.put("sampleRateHz", 48000);
    metadata.put("outputFormat", "wav");
    metadata.put("executionSemantics", "LOCAL_RETRYABLE");
    metadata.put("referenceAssetId", command.referenceAssetId().toString());
    metadata.put("referenceFilename", referenceFilename);
    if (command.description() != null && !command.description().isBlank()) {
      metadata.put("description", command.description().trim());
    }
    return objectMapper.writeValueAsString(metadata);
  }
}
