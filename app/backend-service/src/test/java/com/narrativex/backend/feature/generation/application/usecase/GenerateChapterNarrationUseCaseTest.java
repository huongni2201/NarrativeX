package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.catalog.application.port.in.VoiceCatalogAccess;
import com.narrativex.backend.feature.generation.application.command.GenerateChapterNarrationCommand;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.port.out.GenerationOutboxRepository;
import com.narrativex.backend.feature.generation.application.port.out.NarrationOperationRepository;
import com.narrativex.backend.feature.generation.application.port.out.NarrationRequestRepository;
import com.narrativex.backend.feature.generation.application.port.out.OperationPlanRepository;
import com.narrativex.backend.feature.generation.application.port.out.QuotaReservation;
import com.narrativex.backend.feature.generation.application.port.out.StageAttemptRepository;
import com.narrativex.backend.feature.generation.application.port.out.VoiceReferenceAssetAccess;
import com.narrativex.backend.feature.generation.application.service.NarrationAdmissionService;
import com.narrativex.backend.feature.generation.application.service.NarrationRequestFingerprint;
import com.narrativex.backend.feature.generation.domain.enums.JobStatus;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSource;
import com.narrativex.backend.feature.storyboard.application.port.in.ChapterAnalysisSourceAccess;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GenerateChapterNarrationUseCaseTest {
  @Test
  void onlyExplicitRegenerationCanReplaceCompletedNarration() {
    assertThat(GenerateChapterNarrationUseCase.canStartAnotherAttempt(JobStatus.COMPLETED, false))
        .isFalse();
    assertThat(GenerateChapterNarrationUseCase.canStartAnotherAttempt(JobStatus.COMPLETED, true))
        .isTrue();
    assertThat(GenerateChapterNarrationUseCase.canStartAnotherAttempt(JobStatus.FAILED, false))
        .isTrue();
    assertThat(GenerateChapterNarrationUseCase.canStartAnotherAttempt(JobStatus.CANCELED, false))
        .isTrue();
    assertThat(GenerateChapterNarrationUseCase.canStartAnotherAttempt(JobStatus.RUNNING, true))
        .isFalse();
  }

  @Test
  void missingOrDisabledCatalogVoiceFailsBeforeAdmissionOrReservation() {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();
    UUID storyVersionId = UUID.randomUUID();
    String ownerId = "owner";

    CurrentUserId currentUserId = mock(CurrentUserId.class);
    ProjectAccess projectAccess = mock(ProjectAccess.class);
    ChapterAnalysisSourceAccess chapterSourceAccess = mock(ChapterAnalysisSourceAccess.class);
    GenerationJobRepository generationJobRepository = mock(GenerationJobRepository.class);
    GenerationOutboxRepository generationOutboxRepository = mock(GenerationOutboxRepository.class);
    OperationPlanRepository operationPlanRepository = mock(OperationPlanRepository.class);
    StageAttemptRepository stageAttemptRepository = mock(StageAttemptRepository.class);
    NarrationRequestRepository narrationRequestRepository = mock(NarrationRequestRepository.class);
    NarrationOperationRepository narrationOperationRepository = mock(NarrationOperationRepository.class);
    NarrationAdmissionService admissionService = mock(NarrationAdmissionService.class);
    NarrationRequestFingerprint fingerprintService = mock(NarrationRequestFingerprint.class);
    QuotaReservation quotaReservation = mock(QuotaReservation.class);
    VoiceReferenceAssetAccess voiceReferenceAssetAccess = mock(VoiceReferenceAssetAccess.class);
    VoiceCatalogAccess voiceCatalogAccess = mock(VoiceCatalogAccess.class);
    Project project = mock(Project.class);

    when(currentUserId.get()).thenReturn(ownerId);
    when(chapterSourceAccess.requireOwnedForAnalysisLocked(projectId, chapterId, ownerId))
        .thenReturn(
            new ChapterAnalysisSource(
                chapterId, storyVersionId, 7L, "a".repeat(64), "Narration source text"));
    when(projectAccess.findOwnedProject(projectId, ownerId)).thenReturn(project);
    when(project.getSourceLanguage()).thenReturn("vi");
    when(voiceCatalogAccess.findVoice("vieneu-disabled")).thenReturn(Optional.empty());

    var useCase =
        new GenerateChapterNarrationUseCase(
            currentUserId,
            projectAccess,
            chapterSourceAccess,
            generationJobRepository,
            generationOutboxRepository,
            operationPlanRepository,
            stageAttemptRepository,
            narrationRequestRepository,
            narrationOperationRepository,
            admissionService,
            fingerprintService,
            quotaReservation,
            voiceReferenceAssetAccess,
            voiceCatalogAccess);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GenerateChapterNarrationCommand(
                        projectId,
                        chapterId,
                        "vieneu-disabled",
                        BigDecimal.ONE,
                        null)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("unavailable or disabled");

    verifyNoInteractions(
        admissionService,
        quotaReservation,
        generationJobRepository,
        generationOutboxRepository,
        operationPlanRepository,
        stageAttemptRepository,
        narrationRequestRepository,
        narrationOperationRepository,
        fingerprintService,
        voiceReferenceAssetAccess);
  }
}
