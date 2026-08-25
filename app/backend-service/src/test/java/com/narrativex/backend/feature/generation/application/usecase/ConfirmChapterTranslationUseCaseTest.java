package com.narrativex.backend.feature.generation.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.uuid.UuidV7;
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
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ConfirmChapterTranslationUseCaseTest {
  private static final String HASH = "a".repeat(64);
  private static final UUID PROJECT_ID = UuidV7.random();
  private static final UUID CHAPTER_ID = UuidV7.random();
  private static final UUID STORY_VERSION_ID = UuidV7.random();
  private static final UUID VARIANT_77 = UuidV7.random();
  private static final UUID VARIANT_55 = UuidV7.random();

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
    var source = variant(VARIANT_77, ContentVariantType.TRANSLATION, HASH);
    givenChapter(chapter);
    when(variantAccess.findByIdOwned(PROJECT_ID, CHAPTER_ID, VARIANT_77, "user-1"))
        .thenReturn(Optional.of(source));

    assertThrows(
        IllegalArgumentException.class,
        () ->
            useCase.execute(
                new ConfirmChapterTranslationCommand(
                    PROJECT_ID, CHAPTER_ID, VARIANT_77, HASH, "vi-VN")));

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
    var source = variant(VARIANT_55, ContentVariantType.ORIGINAL, HASH);
    givenChapter(chapter);
    when(variantAccess.findByIdOwned(PROJECT_ID, CHAPTER_ID, VARIANT_55, "user-1"))
        .thenReturn(Optional.of(source));
    when(variantAccess.findCurrentOriginalOwned(PROJECT_ID, CHAPTER_ID, "user-1"))
        .thenReturn(Optional.of(source));
    var project =
        org.mockito.Mockito.mock(
            com.narrativex.backend.feature.project.domain.aggregate.Project.class);
    when(project.getProjectLanguage()).thenReturn("vi-VN");
    when(projectAccess.findOwnedProject(PROJECT_ID, "user-1")).thenReturn(project);
    var existing = org.mockito.Mockito.mock(GenerationJob.class);
    String expectedKey =
        "chapter-translation:"
            + CHAPTER_ID
            + ":"
            + VARIANT_55
            + ":"
            + HASH
            + ":vi-vn:translation-v1";
    when(generationJobRepository.findByIdempotencyKey(expectedKey, "user-1"))
        .thenReturn(Optional.of(existing));

    assertEquals(
        existing,
        useCase.execute(
            new ConfirmChapterTranslationCommand(
                PROJECT_ID, CHAPTER_ID, VARIANT_55, HASH, "VI-VN")));

    verify(generationJobRepository).acquireIdempotencyLock(eq(expectedKey), eq("user-1"));
  }

  private void givenChapter(Chapter chapter) {
    when(currentUserId.get()).thenReturn("user-1");
    when(chapterAccess.findById(CHAPTER_ID)).thenReturn(Optional.of(chapter));
  }

  private static Chapter chapter() {
    return Chapter.rehydrate(CHAPTER_ID, 4L, STORY_VERSION_ID, 1, "Chapter", "source", HASH);
  }

  private static ChapterContentVariant variant(
      UUID id, ContentVariantType type, String sourceHash) {
    return new ChapterContentVariant(
        id,
        CHAPTER_ID,
        type == ContentVariantType.ORIGINAL ? null : UuidV7.random(),
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
