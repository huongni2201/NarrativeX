package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.account.application.port.in.UserQuotaAccess;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.generation.application.command.CreateMediaJobCommand;
import com.narrativex.backend.feature.generation.application.port.out.ChapterMediaHeadRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.ImageGenerationCatalog;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CreateMediaJobUseCaseTest {
  private static final UUID PROJECT_ID = UUID.randomUUID();
  private static final UUID CHAPTER_ID = UUID.randomUUID();
  private static final UUID ACTIVE_INTERNAL_JOB_ID = UUID.randomUUID();

  @Mock private CurrentUserId currentUserId;
  @Mock private ProjectAccess projectAccess;
  @Mock private ChapterAnalysisSourceAccess chapterSourceAccess;
  @Mock private MediaPlanningSourceAccess mediaPlanningSourceAccess;
  @Mock private CreateMediaPlanUseCase createMediaPlanUseCase;
  @Mock private GenerationJobRepository generationJobRepository;
  @Mock private ChapterMediaHeadRepository chapterMediaHeadRepository;
  @Mock private MediaGenerationItemRepository mediaGenerationItemRepository;
  @Mock private GenerationOutboxRepository generationOutboxRepository;
  @Mock private OperationPlanRepository operationPlanRepository;
  @Mock private StageAttemptRepository stageAttemptRepository;
  @Mock private QuotaReservation quotaReservation;
  @Mock private UserQuotaAccess userQuotaAccess;
  @Mock private ImageGenerationCatalog imageGenerationCatalog;
  @Mock private GenerationJob activeJob;
  @Mock private GenerationJob existingJob;
  @Mock private MediaGenerationItem existingItem;

  @InjectMocks private CreateMediaJobUseCase useCase;

  @Test
  void normalizesIdempotencyKeyBeforePersistence() {
    assertThat(CreateMediaJobUseCase.requireIdempotencyKey("  media-request-123  "))
        .isEqualTo("media-request-123");
  }

  @Test
  void acceptsDatabaseMaximumIdempotencyKeyLength() {
    String value = "k".repeat(512);

    assertThat(CreateMediaJobUseCase.requireIdempotencyKey(value)).isEqualTo(value);
  }

  @Test
  void rejectsMissingIdempotencyKey() {
    assertThatThrownBy(() -> CreateMediaJobUseCase.requireIdempotencyKey(null))
        .isInstanceOf(GenerationAdmissionDeniedException.class);
    assertThatThrownBy(() -> CreateMediaJobUseCase.requireIdempotencyKey("   "))
        .isInstanceOf(GenerationAdmissionDeniedException.class);
  }

  @Test
  void rejectsIdempotencyKeyLongerThanDatabaseColumn() {
    assertThatThrownBy(() -> CreateMediaJobUseCase.requireIdempotencyKey("k".repeat(513)))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .hasMessageContaining("512");
  }

  @Test
  void rejectsExistingIdempotencyKeyFromDifferentOperation() {
    when(currentUserId.get()).thenReturn("owner-1");
    when(generationJobRepository.findByIdempotencyKey("shared-key", "owner-1"))
        .thenReturn(Optional.of(existingJob));
    when(existingJob.getType()).thenReturn(JobType.RENDER_PROJECT);

    CreateMediaJobCommand command =
        new CreateMediaJobCommand(
            PROJECT_ID, CHAPTER_ID, "shared-key", "IMAGE_MOTION", "16:9", new BigDecimal("0.25"));

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .hasMessageContaining("Idempotency-Key");

    verifyNoInteractions(mediaGenerationItemRepository, projectAccess, chapterSourceAccess);
  }

  @Test
  void rejectsExistingMediaJobFromDifferentProjectOrChapter() {
    when(currentUserId.get()).thenReturn("owner-1");
    when(generationJobRepository.findByIdempotencyKey("shared-media-key", "owner-1"))
        .thenReturn(Optional.of(existingJob));
    when(existingJob.getType()).thenReturn(JobType.CHAPTER_GENERATE);
    when(existingJob.getProjectId()).thenReturn(PROJECT_ID);
    when(existingJob.getChapterId()).thenReturn(UUID.randomUUID());

    CreateMediaJobCommand command =
        new CreateMediaJobCommand(
            PROJECT_ID,
            CHAPTER_ID,
            "shared-media-key",
            "IMAGE_MOTION",
            "16:9",
            new BigDecimal("0.25"));

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .hasMessageContaining("Idempotency-Key");

    verifyNoInteractions(mediaGenerationItemRepository, projectAccess, chapterSourceAccess);
  }

  @Test
  void rejectsExistingMediaJobWhenRequestFingerprintChanged() {
    UUID existingInternalJobId = UUID.randomUUID();
    when(currentUserId.get()).thenReturn("owner-1");
    when(generationJobRepository.findByIdempotencyKey("same-scope-key", "owner-1"))
        .thenReturn(Optional.of(existingJob));
    when(existingJob.getType()).thenReturn(JobType.CHAPTER_GENERATE);
    when(existingJob.getProjectId()).thenReturn(PROJECT_ID);
    when(existingJob.getChapterId()).thenReturn(CHAPTER_ID);
    when(existingJob.getId()).thenReturn(existingInternalJobId);
    when(mediaGenerationItemRepository.findByJobOwned("owner-1", existingInternalJobId))
        .thenReturn(List.of(existingItem));
    when(existingItem.getMediaPlanId()).thenReturn(UUID.randomUUID());
    when(existingItem.getVisualBeatId()).thenReturn(UUID.randomUUID());
    when(existingItem.getRequestFingerprint()).thenReturn("f".repeat(64));

    CreateMediaJobCommand command =
        new CreateMediaJobCommand(
            PROJECT_ID,
            CHAPTER_ID,
            "same-scope-key",
            "IMAGE_MOTION",
            "16:9",
            new BigDecimal("0.25"));

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .hasMessageContaining("Idempotency-Key");

    verifyNoInteractions(projectAccess, chapterSourceAccess);
  }

  @Test
  void rejectsExistingMediaJobWhenItHasNoFingerprintItems() {
    UUID existingInternalJobId = UUID.randomUUID();
    when(currentUserId.get()).thenReturn("owner-1");
    when(generationJobRepository.findByIdempotencyKey("empty-media-key", "owner-1"))
        .thenReturn(Optional.of(existingJob));
    when(existingJob.getType()).thenReturn(JobType.CHAPTER_GENERATE);
    when(existingJob.getProjectId()).thenReturn(PROJECT_ID);
    when(existingJob.getChapterId()).thenReturn(CHAPTER_ID);
    when(existingJob.getId()).thenReturn(existingInternalJobId);
    when(mediaGenerationItemRepository.findByJobOwned("owner-1", existingInternalJobId))
        .thenReturn(List.of());

    CreateMediaJobCommand command =
        new CreateMediaJobCommand(
            PROJECT_ID,
            CHAPTER_ID,
            "empty-media-key",
            "IMAGE_MOTION",
            "16:9",
            new BigDecimal("0.25"));

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .hasMessageContaining("Idempotency-Key");

    verifyNoInteractions(projectAccess, chapterSourceAccess);
  }

  @Test
  void replaysExistingMediaJobWhenTypeScopeAndRequestFingerprintMatch() {
    UUID existingInternalJobId = UUID.randomUUID();
    UUID mediaPlanId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    CreateMediaJobCommand command =
        new CreateMediaJobCommand(
            PROJECT_ID,
            CHAPTER_ID,
            "valid-replay-key",
            "IMAGE_MOTION",
            "16:9",
            new BigDecimal("0.25"));
    String requestFingerprint =
        sha256(
            PROJECT_ID
                + ":"
                + CHAPTER_ID
                + ":IMAGE_MOTION:16:9:"
                + ImageStyle.CINEMATIC
                + ":API:0.25");
    String itemFingerprint = sha256(requestFingerprint + ":" + mediaPlanId + ":" + visualBeatId);

    when(currentUserId.get()).thenReturn("owner-1");
    when(generationJobRepository.findByIdempotencyKey("valid-replay-key", "owner-1"))
        .thenReturn(Optional.of(existingJob));
    when(existingJob.getType()).thenReturn(JobType.CHAPTER_GENERATE);
    when(existingJob.getProjectId()).thenReturn(PROJECT_ID);
    when(existingJob.getChapterId()).thenReturn(CHAPTER_ID);
    when(existingJob.getId()).thenReturn(existingInternalJobId);
    when(mediaGenerationItemRepository.findByJobOwned("owner-1", existingInternalJobId))
        .thenReturn(List.of(existingItem));
    when(existingItem.getMediaPlanId()).thenReturn(mediaPlanId);
    when(existingItem.getVisualBeatId()).thenReturn(visualBeatId);
    when(existingItem.getRequestFingerprint()).thenReturn(itemFingerprint);

    assertThat(useCase.execute(command)).isSameAs(existingJob);
    verifyNoInteractions(projectAccess, chapterSourceAccess, generationOutboxRepository);
  }

  @Test
  void rejectsDifferentSubmissionWhileChapterMediaJobIsActiveBeforePaidAdmission() {
    when(currentUserId.get()).thenReturn("owner-1");
    when(generationJobRepository.findByIdempotencyKey("intent-2", "owner-1"))
        .thenReturn(Optional.empty());
    when(chapterMediaHeadRepository.findCurrentJobId(CHAPTER_ID))
        .thenReturn(Optional.of(ACTIVE_INTERNAL_JOB_ID));
    when(generationJobRepository.findByIdAndOwner(ACTIVE_INTERNAL_JOB_ID, "owner-1"))
        .thenReturn(Optional.of(activeJob));
    when(activeJob.getStatus()).thenReturn(JobStatus.RUNNING);
    CreateMediaJobCommand command =
        new CreateMediaJobCommand(
            PROJECT_ID, CHAPTER_ID, "intent-2", "IMAGE_MOTION", "16:9", new BigDecimal("0.25"));

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .hasMessageContaining("already active");

    verify(generationJobRepository).findByIdAndOwner(ACTIVE_INTERNAL_JOB_ID, "owner-1");
    verify(generationJobRepository, never()).findByJobIdAndOwner(ACTIVE_INTERNAL_JOB_ID, "owner-1");
    verifyNoInteractions(
        mediaPlanningSourceAccess,
        createMediaPlanUseCase,
        quotaReservation,
        generationOutboxRepository,
        operationPlanRepository,
        stageAttemptRepository,
        userQuotaAccess,
        imageGenerationCatalog);
  }

  private static String sha256(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException(exception);
    }
  }
}
