package com.narrativex.backend.feature.generation.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.ConfirmChapterTranslationCommand;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterContentVariantAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.StoryboardRevisionAccess;
import com.narrativex.backend.feature.storyboard.domain.aggregate.Chapter;
import com.narrativex.backend.feature.storyboard.domain.enums.ContentVariantType;
import com.narrativex.backend.feature.storyboard.domain.enums.TranslationStatus;
import com.narrativex.backend.feature.storyboard.domain.value.ChapterContentVariant;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ConfirmChapterTranslationUseCaseTest {
  private static final String HASH = "a".repeat(64);

  @Mock private CurrentUserId currentUserId;
  @Mock private ChapterAccess chapterAccess;
  @Mock private StoryVersionAccess storyVersionAccess;
  @Mock private ProjectAccess projectAccess;
  @Mock private StoryboardRevisionAccess storyboardRevisionAccess;
  @Mock private ChapterContentVariantAccess variantAccess;
  @Mock private GenerationJobRepository generationJobRepository;
  @Mock private GenerationOutboxRepository generationOutboxRepository;
  @Mock private OperationPlanRepository operationPlanRepository;
  @Mock private StageAttemptRepository stageAttemptRepository;
  @Mock private QuotaReservation quotaReservation;
  @Mock private UserQuotaAccess quotaQuery;
  @InjectMocks private ConfirmChapterTranslationUseCase useCase;

  @Test
  void rejectsTranslationAsSourceBeforeAnyGenerationSideEffect() {
    var chapter = chapter();
    var source = variant(77L, ContentVariantType.TRANSLATION, HASH);
    givenChapter(chapter);
    when(variantAccess.findByIdOwned(7L, 12L, 77L, "user-1")).thenReturn(Optional.of(source));

    assertThrows(
        IllegalArgumentException.class,
        () -> useCase.execute(new ConfirmChapterTranslationCommand(7L, 12L, 77L, HASH, "vi-VN")));

    verify(quotaReservation, never())
        .reserve(
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.anyInt());
    verify(generationJobRepository, never()).save(org.mockito.ArgumentMatchers.any());
  }

  @Test
  void derivesTheSameIdempotencyKeyWithoutAClientHeader() {
    var chapter = chapter();
    var source = variant(55L, ContentVariantType.ORIGINAL, HASH);
    givenChapter(chapter);
    when(variantAccess.findByIdOwned(7L, 12L, 55L, "user-1")).thenReturn(Optional.of(source));
    when(variantAccess.findCurrentOriginalOwned(7L, 12L, "user-1")).thenReturn(Optional.of(source));
    var project =
        org.mockito.Mockito.mock(
            com.narrativex.backend.feature.project.domain.aggregate.Project.class);
    when(project.getProjectLanguage()).thenReturn("vi-VN");
    when(projectAccess.findOwnedProject(7L, "user-1")).thenReturn(project);
    var existing = org.mockito.Mockito.mock(GenerationJob.class);
    when(generationJobRepository.findByIdempotencyKey(
            "chapter-translation:12:55:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:vi-vn:translation-v1",
            "user-1"))
        .thenReturn(Optional.of(existing));

    assertEquals(
        existing,
        useCase.execute(new ConfirmChapterTranslationCommand(7L, 12L, 55L, HASH, "VI-VN")));

    verify(generationJobRepository)
        .acquireIdempotencyLock(
            eq(
                "chapter-translation:12:55:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:vi-vn:translation-v1"),
            eq("user-1"));
  }

  private void givenChapter(Chapter chapter) {
    when(currentUserId.get()).thenReturn("user-1");
    when(chapterAccess.findById(12L)).thenReturn(Optional.of(chapter));
  }

  private static Chapter chapter() {
    return Chapter.rehydrate(12L, 4L, 99L, 1, "Chapter", "source", HASH);
  }

  private static ChapterContentVariant variant(
      Long id, ContentVariantType type, String sourceHash) {
    return new ChapterContentVariant(
        id,
        12L,
        type == ContentVariantType.ORIGINAL ? null : 1L,
        type,
        "en-US",
        "source",
        sourceHash,
        sourceHash,
        null,
        null,
        TranslationStatus.NOT_REQUIRED,
        Instant.now());
  }
}
