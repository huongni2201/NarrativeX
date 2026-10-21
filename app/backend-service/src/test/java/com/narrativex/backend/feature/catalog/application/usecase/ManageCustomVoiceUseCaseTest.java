package com.narrativex.backend.feature.catalog.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.catalog.application.command.CreateCustomVoiceCommand;
import com.narrativex.backend.feature.catalog.application.port.out.CustomVoiceRepository;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.port.in.VoiceReferenceCatalog;
import com.narrativex.backend.feature.generation.application.port.in.VoiceReferenceCatalog.VoiceReferenceView;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;

class ManageCustomVoiceUseCaseTest {
  private final ObjectMapper objectMapper = new ObjectMapper();
  private CustomVoiceRepository repository;
  private VoiceReferenceCatalog references;
  private ManageCustomVoiceUseCase useCase;

  @BeforeEach
  void setUp() {
    repository = mock(CustomVoiceRepository.class);
    references = mock(VoiceReferenceCatalog.class);
    useCase = new ManageCustomVoiceUseCase(repository, references, objectMapper);
  }

  @Test
  void createsCatalogVoiceBoundToReadyReference() throws Exception {
    UUID referenceId = UuidV7.random();
    when(references.get(referenceId)).thenReturn(reference(referenceId, "READY"));
    when(repository.insert(anyString(), anyString(), anyString(), any(), anyString()))
        .thenReturn(true);

    var voice =
        useCase.create(
            new CreateCustomVoiceCommand(
                "  Giọng bà kể  ", "vi-VN", "FEMALE", "Ấm, chậm", referenceId));

    assertTrue(voice.id().startsWith("custom-"));
    assertEquals("Giọng bà kể", voice.name());
    assertEquals("VIENEU", voice.provider());
    var metadata = objectMapper.readTree(voice.metadataJson());
    assertEquals(true, metadata.get("custom").asBoolean());
    assertEquals(referenceId.toString(), metadata.get("referenceAssetId").asText());
    assertEquals("ref.wav", metadata.get("referenceFilename").asText());
    assertEquals("Ấm, chậm", metadata.get("description").asText());

    ArgumentCaptor<String> name = ArgumentCaptor.forClass(String.class);
    verify(repository)
        .insert(eq(voice.id()), name.capture(), eq("vi-VN"), eq("FEMALE"), anyString());
    assertEquals("Giọng bà kể", name.getValue());
  }

  @Test
  void rejectsReferenceThatIsNotReady() {
    UUID referenceId = UuidV7.random();
    when(references.get(referenceId)).thenReturn(reference(referenceId, "PROCESSING"));

    assertThrows(
        IllegalArgumentException.class,
        () ->
            useCase.create(
                new CreateCustomVoiceCommand("Voice", "vi-VN", null, null, referenceId)));
    verify(repository, never()).insert(anyString(), anyString(), anyString(), any(), anyString());
  }

  @Test
  void reportsConflictWhenNameIsTaken() {
    UUID referenceId = UuidV7.random();
    when(references.get(referenceId)).thenReturn(reference(referenceId, "READY"));
    when(repository.insert(anyString(), anyString(), anyString(), any(), anyString()))
        .thenReturn(false);

    assertThrows(
        ResourceConflictException.class,
        () ->
            useCase.create(
                new CreateCustomVoiceCommand("Minh Quân Pro", "vi-VN", null, null, referenceId)));
  }

  @Test
  void deletesOnlyCustomVoices() {
    when(repository.disable("custom-1")).thenReturn(true);

    useCase.delete("custom-1");

    verify(repository).disable("custom-1");
    assertThrows(
        ResourceNotFoundException.class, () -> useCase.delete("vieneu-preset-minh-quan-pro"));
    verify(repository, never()).disable("vieneu-preset-minh-quan-pro");
  }

  @Test
  void reportsMissingWhenCustomVoiceIsAlreadyGone() {
    when(repository.disable("custom-2")).thenReturn(false);

    assertThrows(ResourceNotFoundException.class, () -> useCase.delete("custom-2"));
  }

  private static VoiceReferenceView reference(UUID id, String status) {
    return new VoiceReferenceView(id, "ref.wav", "audio/wav", 2048, "a".repeat(64), status);
  }
}
