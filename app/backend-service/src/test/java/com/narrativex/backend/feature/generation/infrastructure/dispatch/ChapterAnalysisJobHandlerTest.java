package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisExecutionSnapshot;
import com.narrativex.backend.feature.generation.application.model.analysis.ChapterAnalysisRetirement;
import com.narrativex.backend.feature.generation.application.port.out.ChapterAnalysisExecutionStore;
import com.narrativex.backend.feature.generation.application.port.out.GenerationJobRepository;
import com.narrativex.backend.feature.generation.application.service.GenerationJobTransactionService;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class ChapterAnalysisJobHandlerTest {
  @Test
  void retiresQueuedJobWithoutDesktopSnapshotInsteadOfLeavingItUnclaimable() {
    GenerationJob job = queuedAnalysis();
    var transactions = new RecordingTransactionService();
    var store = mock(ChapterAnalysisExecutionStore.class);
    when(store.findSnapshot(job.getId())).thenReturn(Optional.empty());
    var handler = handlerFor(job, transactions, store);

    handler.execute(job.getJobId());

    assertEquals(ChapterAnalysisRetirement.ERROR_CODE, transactions.errorCode);
    assertEquals(ChapterAnalysisRetirement.STEP, transactions.step);
  }

  @Test
  void leavesJobFrozenForDesktopQueuedUntilAnAccountClaimsIt() {
    GenerationJob job = queuedAnalysis();
    var transactions = new RecordingTransactionService();
    var store = mock(ChapterAnalysisExecutionStore.class);
    when(store.findSnapshot(job.getId()))
        .thenReturn(Optional.of(mock(ChapterAnalysisExecutionSnapshot.class)));
    var handler = handlerFor(job, transactions, store);

    handler.execute(job.getJobId());

    assertNull(transactions.errorCode, "a frozen job must not be failed or run on the backend");
  }

  private static ChapterAnalysisJobHandler handlerFor(
      GenerationJob job,
      GenerationJobTransactionService transactions,
      ChapterAnalysisExecutionStore store) {
    var repository = mock(GenerationJobRepository.class);
    when(repository.findByJobId(job.getJobId())).thenReturn(Optional.of(job));
    var handler =
        new ChapterAnalysisJobHandler(repository, transactions, null, null, null, null, null);
    ReflectionTestUtils.setField(handler, "localExecutions", store);
    return handler;
  }

  private static GenerationJob queuedAnalysis() {
    return GenerationJob.createChapterAnalysis(
            UuidV7.random(),
            UuidV7.random(),
            UuidV7.random(),
            UuidV7.random(),
            1L,
            "a".repeat(64),
            "chapter text",
            "vi",
            "analysis-key",
            "VIDEO",
            null)
        .toBuilder()
        .id(UuidV7.random())
        .build();
  }

  private static final class RecordingTransactionService extends GenerationJobTransactionService {
    private String errorCode;
    private String step;

    private RecordingTransactionService() {
      super(null);
    }

    @Override
    public GenerationJob markSubmissionFailed(UUID jobId, String errorCode, String step) {
      this.errorCode = errorCode;
      this.step = step;
      return null;
    }
  }
}
