package com.narrativex.backend.feature.generation.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.command.GenerateBatchNarrationCommand;
import com.narrativex.backend.feature.generation.application.command.GenerateChapterNarrationCommand;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.exception.GenerationAdmissionDeniedException;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class GenerateBatchNarrationUseCaseTest {
  private final GenerateChapterNarrationUseCase chapterUseCase =
      mock(GenerateChapterNarrationUseCase.class);
  private final GenerateBatchNarrationUseCase batchUseCase =
      new GenerateBatchNarrationUseCase(chapterUseCase);

  @Test
  void capacityLimitReturnsAcceptedChaptersAndStopsSubmitting() {
    var command = command();
    var acceptedJob = mock(GenerationJob.class);
    when(chapterUseCase.execute(any(GenerateChapterNarrationCommand.class)))
        .thenReturn(acceptedJob)
        .thenThrow(new GenerationAdmissionDeniedException("CAPACITY_LIMIT", "Capacity exhausted"));

    var accepted = batchUseCase.execute(command);

    assertEquals(1, accepted.size());
    assertEquals(command.chapterIds().getFirst(), accepted.getFirst().chapterId());
    assertSame(acceptedJob, accepted.getFirst().job());
    verify(chapterUseCase, times(2)).execute(any(GenerateChapterNarrationCommand.class));
    verifyNoMoreInteractions(chapterUseCase);
  }

  @Test
  void capacityLimitBeforeAnyAcceptanceIsReported() {
    var denial = new GenerationAdmissionDeniedException("CAPACITY_LIMIT", "Capacity exhausted");
    when(chapterUseCase.execute(any(GenerateChapterNarrationCommand.class))).thenThrow(denial);

    assertSame(
        denial,
        assertThrows(
            GenerationAdmissionDeniedException.class, () -> batchUseCase.execute(command())));
    verify(chapterUseCase).execute(any(GenerateChapterNarrationCommand.class));
    verifyNoMoreInteractions(chapterUseCase);
  }

  @Test
  void otherAdmissionFailuresAreNotHiddenByPartialAcceptance() {
    var denial = new GenerationAdmissionDeniedException("ENTITLEMENT_DENIED", "Plan unavailable");
    when(chapterUseCase.execute(any(GenerateChapterNarrationCommand.class)))
        .thenReturn(mock(GenerationJob.class))
        .thenThrow(denial);

    assertSame(
        denial,
        assertThrows(
            GenerationAdmissionDeniedException.class, () -> batchUseCase.execute(command())));
    verify(chapterUseCase, times(2)).execute(any(GenerateChapterNarrationCommand.class));
    verifyNoMoreInteractions(chapterUseCase);
  }

  private static GenerateBatchNarrationCommand command() {
    return new GenerateBatchNarrationCommand(
        UuidV7.random(),
        List.of(UuidV7.random(), UuidV7.random(), UuidV7.random()),
        "vieneu-test",
        BigDecimal.ONE,
        null);
  }
}
