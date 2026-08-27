package com.narrativex.backend.feature.generation.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterCanon;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.CharacterReference;
import com.narrativex.backend.feature.generation.application.port.out.VisualPromptContextRepository.VisualPromptContext;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GetGeminiVisualContextUseCaseTest {
  @Test
  void selectsOneCanonicalReferencePerCharacterBeforeExtraReferences() {
    CurrentUserId currentUserId = mock(CurrentUserId.class);
    ProjectAccess projectAccess = mock(ProjectAccess.class);
    VisualPromptContextRepository repository = mock(VisualPromptContextRepository.class);
    UUID projectId = UUID.randomUUID();
    UUID sceneId = UUID.randomUUID();
    UUID firstAsset = UUID.randomUUID();
    UUID firstExtra = UUID.randomUUID();
    UUID secondAsset = UUID.randomUUID();

    CharacterCanon first =
        new CharacterCanon(
            UUID.randomUUID(),
            UUID.randomUUID(),
            "Lâm Phong",
            2,
            "long black hair",
            "black robe",
            "adult",
            "long hair",
            null,
            "black robe",
            List.of(
                new CharacterReference(firstExtra, "FULL_BODY", 2, "a", "image/png", "a"),
                new CharacterReference(firstAsset, "FACE", 1, "b", "image/png", "b")));
    CharacterCanon second =
        new CharacterCanon(
            UUID.randomUUID(),
            UUID.randomUUID(),
            "Tiểu Vũ",
            1,
            "red hair",
            "red dress",
            "adult",
            "long hair",
            null,
            "red dress",
            List.of(new CharacterReference(secondAsset, "FACE", 1, "c", "image/png", "c")));

    when(currentUserId.get()).thenReturn("user-1");
    when(repository.findForScene(projectId, sceneId))
        .thenReturn(new VisualPromptContext(null, List.of(first, second)));

    var useCase = new GetGeminiVisualContextUseCase(currentUserId, projectAccess, repository);
    var result = useCase.execute(projectId, sceneId);

    verify(projectAccess).findOwnedProject(projectId, "user-1");
    assertEquals(2, result.references().size());
    assertEquals("REF_01", result.references().get(0).referenceKey());
    assertEquals(firstAsset, result.references().get(0).assetId());
    assertEquals("Lâm Phong", result.references().get(0).characterName());
    assertEquals("REF_02", result.references().get(1).referenceKey());
    assertEquals(secondAsset, result.references().get(1).assetId());
    assertEquals("Tiểu Vũ", result.references().get(1).characterName());
  }
}
