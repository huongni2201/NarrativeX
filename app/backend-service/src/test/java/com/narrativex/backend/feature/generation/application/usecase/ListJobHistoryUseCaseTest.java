package com.narrativex.backend.feature.generation.application.usecase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.pagination.CursorPage;
import com.narrativex.backend.feature.generation.application.port.out.JobHistoryQueryRepository;
import com.narrativex.backend.feature.generation.application.query.JobHistoryView;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ListJobHistoryUseCaseTest {

  @Mock private JobHistoryQueryRepository repository;

  @InjectMocks private ListJobHistoryUseCase useCase;

  @Test
  @DisplayName("Queries job history scoped by projectId")
  void queriesJobHistoryScopedByProjectId() {
    UUID projectId = UUID.randomUUID();
    JobHistoryView view =
        new JobHistoryView(
            UUID.randomUUID(),
            UUID.randomUUID(),
            projectId,
            "Project Alpha",
            "VIDEO",
            "COMPLETED",
            100,
            "FINALIZE",
            null,
            Instant.now(),
            Instant.now());

    when(repository.list(eq(projectId), isNull(), eq(21))).thenReturn(List.of(view));

    CursorPage<JobHistoryView> page = useCase.execute(projectId, null, 20);

    assertThat(page.content()).hasSize(1);
    assertThat(page.content().getFirst().projectId()).isEqualTo(projectId);
    verify(repository).list(eq(projectId), isNull(), eq(21));
  }

  @Test
  @DisplayName("Queries global job history when projectId is null")
  void queriesGlobalJobHistoryWhenProjectIdNull() {
    when(repository.list(isNull(), isNull(), eq(21))).thenReturn(List.of());

    CursorPage<JobHistoryView> page = useCase.execute(null, null, 20);

    assertThat(page.content()).isEmpty();
    verify(repository).list(isNull(), isNull(), eq(21));
  }
}
