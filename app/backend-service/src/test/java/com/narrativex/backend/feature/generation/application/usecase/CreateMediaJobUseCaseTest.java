package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.narrativex.backend.configuration.NarrativeXLimitsProperties;
import com.narrativex.backend.feature.generation.application.command.CreateMediaJobCommand;
import com.narrativex.backend.feature.generation.application.command.CreateMediaPlanCommand;
import com.narrativex.backend.feature.generation.application.model.prompt.PromptSettingsDefaults;
import com.narrativex.backend.feature.generation.application.port.in.PromptSettingsAccess;
import com.narrativex.backend.feature.generation.application.port.out.ChapterMediaHeadRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.ImageGenerationCatalog;
import com.narrativex.backend.feature.generation.application.port.out.MediaGenerationItemRepository;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.entity.MediaGenerationItem;
import com.narrativex.backend.feature.generation.domain.enums.ImageStyle;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ProductionMode;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource;
import com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSourceAccess;
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

  @Mock private ProjectAccess projectAccess;
  @Mock private ChapterAnalysisSourceAccess chapterSourceAccess;
  @Mock private MediaPlanningSourceAccess mediaPlanningSourceAccess;
  @Mock private CreateMediaPlanUseCase createMediaPlanUseCase;
  @Mock private GenerationJobRepository generationJobRepository;
  @Mock private ChapterMediaHeadRepository chapterMediaHeadRepository;
  @Mock private MediaGenerationItemRepository mediaGenerationItemRepository;
  @Mock private GenerationOutboxRepository generationOutboxRepository;
  @Mock private StageAttemptRepository stageAttemptRepository;
  @Mock private ImageGenerationCatalog imageGenerationCatalog;
  @Mock private PromptSettingsAccess promptSettingsAccess;

  @Mock
  private com.narrativex.backend.feature.generation.application.port.out.VideoGenerationCatalog
      videoGenerationCatalog;

  @Mock private NarrativeXLimitsProperties limits;
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
    when(generationJobRepository.findByIdempotencyKey("shared-key"))
        .thenReturn(Optional.of(existingJob));
    when(existingJob.getType()).thenReturn(JobType.RENDER_PROJECT);

    CreateMediaJobCommand command =
        new CreateMediaJobCommand(
            PROJECT_ID, CHAPTER_ID, "shared-key", "IMAGE_MOTION", "16:9", ImageStyle.CINEMATIC);

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .hasMessageContaining("Idempotency-Key");

    verifyNoInteractions(mediaGenerationItemRepository, projectAccess, chapterSourceAccess);
  }

  @Test
  void rejectsExistingMediaJobFromDifferentProjectOrChapter() {
    when(generationJobRepository.findByIdempotencyKey("shared-media-key"))
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
            ImageStyle.CINEMATIC);

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .hasMessageContaining("Idempotency-Key");

    verifyNoInteractions(mediaGenerationItemRepository, projectAccess, chapterSourceAccess);
  }

  @Test
  void rejectsExistingMediaJobWhenRequestFingerprintChanged() {
    UUID existingInternalJobId = UUID.randomUUID();
    when(generationJobRepository.findByIdempotencyKey("same-scope-key"))
        .thenReturn(Optional.of(existingJob));
    when(existingJob.getType()).thenReturn(JobType.CHAPTER_GENERATE);
    when(existingJob.getProjectId()).thenReturn(PROJECT_ID);
    when(existingJob.getChapterId()).thenReturn(CHAPTER_ID);
    when(existingJob.getProductionMode()).thenReturn(ProductionMode.IMAGE_MOTION);
    when(existingJob.getId()).thenReturn(existingInternalJobId);
    when(mediaGenerationItemRepository.findByJobId(existingInternalJobId))
        .thenReturn(List.of(existingItem));
    when(existingItem.getMediaPlanId()).thenReturn(UUID.randomUUID());
    when(existingItem.getVisualBeatId()).thenReturn(UUID.randomUUID());
    when(existingItem.getRequestFingerprint()).thenReturn("f".repeat(64));

    CreateMediaJobCommand command =
        new CreateMediaJobCommand(
            PROJECT_ID, CHAPTER_ID, "same-scope-key", "IMAGE_MOTION", "16:9", ImageStyle.CINEMATIC);

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .hasMessageContaining("Idempotency-Key");

    verifyNoInteractions(projectAccess, chapterSourceAccess);
  }

  @Test
  void rejectsExistingMediaJobWhenItHasNoFingerprintItems() {
    UUID existingInternalJobId = UUID.randomUUID();
    when(generationJobRepository.findByIdempotencyKey("empty-media-key"))
        .thenReturn(Optional.of(existingJob));
    when(existingJob.getType()).thenReturn(JobType.CHAPTER_GENERATE);
    when(existingJob.getProjectId()).thenReturn(PROJECT_ID);
    when(existingJob.getChapterId()).thenReturn(CHAPTER_ID);
    when(existingJob.getProductionMode()).thenReturn(ProductionMode.IMAGE_MOTION);
    when(existingJob.getId()).thenReturn(existingInternalJobId);
    when(mediaGenerationItemRepository.findByJobId(existingInternalJobId)).thenReturn(List.of());

    CreateMediaJobCommand command =
        new CreateMediaJobCommand(
            PROJECT_ID,
            CHAPTER_ID,
            "empty-media-key",
            "IMAGE_MOTION",
            "16:9",
            ImageStyle.CINEMATIC);

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
            ImageStyle.CINEMATIC);
    String requestFingerprint = CreateMediaJobUseCase.fingerprint(command, "API");
    String itemFingerprint = sha256(requestFingerprint + ":" + mediaPlanId + ":" + visualBeatId);

    when(generationJobRepository.findByIdempotencyKey("valid-replay-key"))
        .thenReturn(Optional.of(existingJob));
    when(existingJob.getType()).thenReturn(JobType.CHAPTER_GENERATE);
    when(existingJob.getProjectId()).thenReturn(PROJECT_ID);
    when(existingJob.getChapterId()).thenReturn(CHAPTER_ID);
    when(existingJob.getProductionMode()).thenReturn(ProductionMode.IMAGE_MOTION);
    when(existingJob.getId()).thenReturn(existingInternalJobId);
    when(mediaGenerationItemRepository.findByJobId(existingInternalJobId))
        .thenReturn(List.of(existingItem));
    when(existingItem.getMediaPlanId()).thenReturn(mediaPlanId);
    when(existingItem.getVisualBeatId()).thenReturn(visualBeatId);
    when(existingItem.getRequestFingerprint()).thenReturn(itemFingerprint);

    assertThat(useCase.execute(command)).isSameAs(existingJob);
    verifyNoInteractions(projectAccess, chapterSourceAccess, generationOutboxRepository);
  }

  @Test
  void requestFingerprintDoesNotDependOnTheStyleOrAnyPromptConfiguration() {
    var cinematic =
        new CreateMediaJobCommand(
            PROJECT_ID, CHAPTER_ID, "k", "IMAGE_MOTION", "16:9", ImageStyle.CINEMATIC);
    var anime =
        new CreateMediaJobCommand(
            PROJECT_ID, CHAPTER_ID, "k", "IMAGE_MOTION", "16:9", ImageStyle.CINEMATIC_ANIME);
    var withRevision =
        new CreateMediaJobCommand(
            PROJECT_ID, CHAPTER_ID, "k", "IMAGE_MOTION", "16:9", null, "IMAGE", "API", 42L);

    assertThat(CreateMediaJobUseCase.fingerprint(cinematic, "API"))
        .isEqualTo(CreateMediaJobUseCase.fingerprint(anime, "API"))
        .isEqualTo(CreateMediaJobUseCase.fingerprint(withRevision, "API"));
    assertThat(CreateMediaJobUseCase.legacyFingerprint(cinematic, "API"))
        .isNotEqualTo(CreateMediaJobUseCase.legacyFingerprint(anime, "API"));
  }

  @Test
  void replayDoesNotResolveOrCompareCurrentPromptSettings() {
    UUID existingInternalJobId = UUID.randomUUID();
    UUID mediaPlanId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    // Admitted earlier; the installation style has been changed and saved since, and this replay
    // even carries a different legacy style hint and a stale expected revision.
    var original =
        new CreateMediaJobCommand(
            PROJECT_ID, CHAPTER_ID, "replay-after-save", "IMAGE_MOTION", "16:9", null);
    var replay =
        new CreateMediaJobCommand(
            PROJECT_ID,
            CHAPTER_ID,
            "replay-after-save",
            "IMAGE_MOTION",
            "16:9",
            null,
            "IMAGE",
            "API",
            1L);
    String itemFingerprint =
        sha256(
            CreateMediaJobUseCase.fingerprint(original, "API")
                + ":"
                + mediaPlanId
                + ":"
                + visualBeatId);
    stubExistingJob(
        "replay-after-save", existingInternalJobId, mediaPlanId, visualBeatId, itemFingerprint);

    assertThat(useCase.execute(replay)).isSameAs(existingJob);

    verifyNoInteractions(promptSettingsAccess, createMediaPlanUseCase, generationOutboxRepository);
  }

  @Test
  void replaysJobsAdmittedBeforePromptSettingsUsingTheLegacyFingerprint() {
    UUID existingInternalJobId = UUID.randomUUID();
    UUID mediaPlanId = UUID.randomUUID();
    UUID visualBeatId = UUID.randomUUID();
    var command =
        new CreateMediaJobCommand(
            PROJECT_ID, CHAPTER_ID, "legacy-key", "IMAGE_MOTION", "16:9", ImageStyle.CINEMATIC);
    String legacyItemFingerprint =
        sha256(
            CreateMediaJobUseCase.legacyFingerprint(command, "API")
                + ":"
                + mediaPlanId
                + ":"
                + visualBeatId);
    stubExistingJob(
        "legacy-key", existingInternalJobId, mediaPlanId, visualBeatId, legacyItemFingerprint);

    assertThat(useCase.execute(command)).isSameAs(existingJob);
    verifyNoInteractions(promptSettingsAccess);
  }

  @Test
  void staleExpectedPromptRevisionIsAConflictBeforeAnyPlanIsCreated() {
    when(generationJobRepository.findByIdempotencyKey("stale-preview"))
        .thenReturn(Optional.empty());
    when(promptSettingsAccess.current())
        .thenReturn(PromptSettingsDefaults.settings().withRevision(3));
    var command =
        new CreateMediaJobCommand(
            PROJECT_ID,
            CHAPTER_ID,
            "stale-preview",
            "IMAGE_MOTION",
            "16:9",
            null,
            "IMAGE",
            "API",
            2L);

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOfSatisfying(
            GenerationAdmissionDeniedException.class,
            denied -> assertThat(denied.getCode()).isEqualTo("PROMPT_SETTINGS_CHANGED"))
        .hasMessageContaining("revision 2")
        .hasMessageContaining("3");

    verify(createMediaPlanUseCase, never()).execute(any());
    verifyNoInteractions(generationOutboxRepository);
  }

  @Test
  void newAdmissionResolvesSettingsOnceAndPassesThemToThePlan() {
    var current = PromptSettingsDefaults.settings().withActiveStyle("CINEMATIC").withRevision(6);
    when(generationJobRepository.findByIdempotencyKey("fresh")).thenReturn(Optional.empty());
    when(promptSettingsAccess.current()).thenReturn(current);
    when(mediaPlanningSourceAccess.requireCurrent(CHAPTER_ID))
        .thenReturn(
            org.mockito.Mockito.mock(
                com.narrativex.backend.feature.storyboard.application.port.in.MediaPlanningSource
                    .class));
    when(imageGenerationCatalog.resolve())
        .thenReturn(new ImageGenerationCatalog.ImageGenerationProfile("api", "image-model"));
    when(limits.getMaxConcurrentExpensiveJobs()).thenReturn(5);
    var project =
        org.mockito.Mockito.mock(
            com.narrativex.backend.feature.project.domain.aggregate.Project.class);
    when(projectAccess.findProject(PROJECT_ID)).thenReturn(project);
    var sentinel = new IllegalStateException("stop after plan command");
    when(createMediaPlanUseCase.execute(any())).thenThrow(sentinel);
    var command =
        new CreateMediaJobCommand(
            PROJECT_ID,
            CHAPTER_ID,
            "fresh",
            "IMAGE_MOTION",
            "16:9",
            ImageStyle.CINEMATIC_ANIME,
            "IMAGE",
            "API",
            6L);

    assertThatThrownBy(() -> useCase.execute(command)).isSameAs(sentinel);

    var captured = org.mockito.ArgumentCaptor.forClass(CreateMediaPlanCommand.class);
    verify(createMediaPlanUseCase).execute(captured.capture());
    // The legacy ImageStyle hint is ignored: the plan gets the saved configuration.
    assertThat(captured.getValue().promptSettings()).isSameAs(current);
    verify(promptSettingsAccess, org.mockito.Mockito.times(1)).current();
  }

  @Test
  void singleBeatImageAttemptFreezesOnlyTheApprovedBeat() {
    UUID targetBeatId = UUID.randomUUID();
    UUID otherBeatId = UUID.randomUUID();
    var current = PromptSettingsDefaults.settings().withActiveStyle("CINEMATIC").withRevision(6);
    var planningSource =
        new MediaPlanningSource(
            List.of(
                new MediaPlanningSource.SceneSnapshot(
                    UUID.randomUUID(),
                    1,
                    "Scene narration",
                    10,
                    List.of(
                        new MediaPlanningSource.BeatSnapshot(
                            targetBeatId, 1, "Target beat", MediaPlanningSource.MotionIntent.STILL),
                        new MediaPlanningSource.BeatSnapshot(
                            otherBeatId,
                            2,
                            "Other beat",
                            MediaPlanningSource.MotionIntent.STILL)))));
    when(generationJobRepository.findByIdempotencyKey("one-beat-image"))
        .thenReturn(Optional.empty());
    when(promptSettingsAccess.current()).thenReturn(current);
    when(chapterSourceAccess.requireForAnalysisLocked(PROJECT_ID, CHAPTER_ID))
        .thenReturn(
            new ChapterAnalysisSource(CHAPTER_ID, UUID.randomUUID(), 1L, "a".repeat(64), "source"));
    when(mediaPlanningSourceAccess.requireCurrent(CHAPTER_ID)).thenReturn(planningSource);
    when(imageGenerationCatalog.resolve())
        .thenReturn(new ImageGenerationCatalog.ImageGenerationProfile("api", "image-model"));
    when(limits.getMaxConcurrentExpensiveJobs()).thenReturn(5);
    when(projectAccess.findProject(PROJECT_ID))
        .thenReturn(
            org.mockito.Mockito.mock(
                com.narrativex.backend.feature.project.domain.aggregate.Project.class));
    var sentinel = new IllegalStateException("stop after plan command");
    when(createMediaPlanUseCase.execute(any())).thenThrow(sentinel);
    var command =
        new CreateMediaJobCommand(
            PROJECT_ID,
            CHAPTER_ID,
            "one-beat-image",
            "LEGACY_IMAGE",
            "16:9",
            ImageStyle.CINEMATIC,
            "IMAGE",
            "API",
            6L,
            targetBeatId);

    assertThatThrownBy(() -> useCase.execute(command)).isSameAs(sentinel);

    var captured = org.mockito.ArgumentCaptor.forClass(CreateMediaPlanCommand.class);
    verify(createMediaPlanUseCase).execute(captured.capture());
    assertThat(captured.getValue().includedBeatIds()).containsExactly(targetBeatId);
    var otherBeatCommand =
        new CreateMediaJobCommand(
            PROJECT_ID,
            CHAPTER_ID,
            "other-beat-image",
            "LEGACY_IMAGE",
            "16:9",
            ImageStyle.CINEMATIC,
            "IMAGE",
            "API",
            6L,
            otherBeatId);
    assertThat(CreateMediaJobUseCase.fingerprint(command, "API"))
        .isNotEqualTo(CreateMediaJobUseCase.fingerprint(otherBeatCommand, "API"));
  }

  @Test
  void rejectsSingleBeatScopeForVideoFirstJobs() {
    var command =
        new CreateMediaJobCommand(
            PROJECT_ID,
            CHAPTER_ID,
            "single-beat-video",
            "VIDEO_FIRST",
            "16:9",
            ImageStyle.CINEMATIC,
            "VIDEO",
            null,
            null,
            UUID.randomUUID());

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .hasMessageContaining("only supported for image jobs");
    verifyNoInteractions(projectAccess, chapterSourceAccess, mediaPlanningSourceAccess);
  }

  @Test
  void perBeatImageAttemptPassesExactlyOneApprovedBeatToThePlan() {
    UUID targetBeatId = UUID.randomUUID();
    UUID otherBeatId = UUID.randomUUID();
    var current = PromptSettingsDefaults.settings().withActiveStyle("CINEMATIC").withRevision(6);
    var planningSource =
        new MediaPlanningSource(
            List.of(
                new MediaPlanningSource.SceneSnapshot(
                    UUID.randomUUID(),
                    1,
                    "Scene narration",
                    10,
                    List.of(
                        new MediaPlanningSource.BeatSnapshot(
                            targetBeatId, 1, "Target beat", MediaPlanningSource.MotionIntent.STILL),
                        new MediaPlanningSource.BeatSnapshot(
                            otherBeatId,
                            2,
                            "Other beat",
                            MediaPlanningSource.MotionIntent.STILL)))));
    when(generationJobRepository.findByIdempotencyKey("one-beat-image"))
        .thenReturn(Optional.empty());
    when(promptSettingsAccess.current()).thenReturn(current);
    when(chapterSourceAccess.requireForAnalysisLocked(PROJECT_ID, CHAPTER_ID))
        .thenReturn(
            new ChapterAnalysisSource(CHAPTER_ID, UUID.randomUUID(), 1L, "a".repeat(64), "source"));
    when(mediaPlanningSourceAccess.requireCurrent(CHAPTER_ID)).thenReturn(planningSource);
    when(imageGenerationCatalog.resolve())
        .thenReturn(new ImageGenerationCatalog.ImageGenerationProfile("api", "image-model"));
    when(limits.getMaxConcurrentExpensiveJobs()).thenReturn(5);
    when(projectAccess.findProject(PROJECT_ID))
        .thenReturn(
            org.mockito.Mockito.mock(
                com.narrativex.backend.feature.project.domain.aggregate.Project.class));
    var sentinel = new IllegalStateException("stop after plan command");
    when(createMediaPlanUseCase.execute(any())).thenThrow(sentinel);
    var command =
        new CreateMediaJobCommand(
            PROJECT_ID,
            CHAPTER_ID,
            "one-beat-image",
            "LEGACY_IMAGE",
            "16:9",
            ImageStyle.CINEMATIC,
            "IMAGE",
            "API",
            6L,
            targetBeatId);

    assertThatThrownBy(() -> useCase.execute(command)).isSameAs(sentinel);

    var captured = org.mockito.ArgumentCaptor.forClass(CreateMediaPlanCommand.class);
    verify(createMediaPlanUseCase).execute(captured.capture());
    assertThat(captured.getValue().includedBeatIds()).containsExactly(targetBeatId);
    var otherBeatCommand =
        new CreateMediaJobCommand(
            PROJECT_ID,
            CHAPTER_ID,
            "other-beat-image",
            "LEGACY_IMAGE",
            "16:9",
            ImageStyle.CINEMATIC,
            "IMAGE",
            "API",
            6L,
            otherBeatId);
    assertThat(CreateMediaJobUseCase.fingerprint(command, "API"))
        .isNotEqualTo(CreateMediaJobUseCase.fingerprint(otherBeatCommand, "API"));
  }

  private void stubExistingJob(
      String key, UUID internalJobId, UUID mediaPlanId, UUID visualBeatId, String itemFingerprint) {
    when(generationJobRepository.findByIdempotencyKey(key)).thenReturn(Optional.of(existingJob));
    when(existingJob.getType()).thenReturn(JobType.CHAPTER_GENERATE);
    when(existingJob.getProjectId()).thenReturn(PROJECT_ID);
    when(existingJob.getChapterId()).thenReturn(CHAPTER_ID);
    when(existingJob.getProductionMode()).thenReturn(ProductionMode.IMAGE_MOTION);
    when(existingJob.getId()).thenReturn(internalJobId);
    when(mediaGenerationItemRepository.findByJobId(internalJobId))
        .thenReturn(List.of(existingItem));
    when(existingItem.getMediaPlanId()).thenReturn(mediaPlanId);
    when(existingItem.getVisualBeatId()).thenReturn(visualBeatId);
    when(existingItem.getRequestFingerprint()).thenReturn(itemFingerprint);
  }

  @Test
  void rejectsDifferentSubmissionWhileChapterMediaJobIsActiveBeforeAdmission() {
    when(generationJobRepository.findByIdempotencyKey("intent-2")).thenReturn(Optional.empty());
    when(chapterMediaHeadRepository.findCurrentJobId(CHAPTER_ID))
        .thenReturn(Optional.of(ACTIVE_INTERNAL_JOB_ID));
    when(generationJobRepository.findById(ACTIVE_INTERNAL_JOB_ID))
        .thenReturn(Optional.of(activeJob));
    when(activeJob.getStatus()).thenReturn(JobStatus.RUNNING);
    CreateMediaJobCommand command =
        new CreateMediaJobCommand(
            PROJECT_ID, CHAPTER_ID, "intent-2", "IMAGE_MOTION", "16:9", ImageStyle.CINEMATIC);

    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(GenerationAdmissionDeniedException.class)
        .hasMessageContaining("already active");

    verify(generationJobRepository).findById(ACTIVE_INTERNAL_JOB_ID);
    verifyNoInteractions(
        mediaPlanningSourceAccess,
        createMediaPlanUseCase,
        generationOutboxRepository,
        stageAttemptRepository,
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
