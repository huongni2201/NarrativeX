package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationOutboxMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.OutboxDispatchRow;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

class GenerationOutboxDispatcherTest {
  @Test
  void finalizesEveryReservedOutboxRowWithoutExternalBroker() {
    GenerationOutboxMapper mapper = mock(GenerationOutboxMapper.class);
    PlatformTransactionManager transactionManager = transactionManager();
    when(mapper.reserveBatch(anyLong())).thenReturn(List.of(row(1L), row(2L), row(3L)));

    new GenerationOutboxDispatcher(mapper, transactionManager).dispatchPending();

    verify(mapper).markPublished(1L);
    verify(mapper).markPublished(2L);
    verify(mapper).markPublished(3L);
  }

  @Test
  void oneAcknowledgementFailureDoesNotBlockLaterRows() {
    GenerationOutboxMapper mapper = mock(GenerationOutboxMapper.class);
    PlatformTransactionManager transactionManager = transactionManager();
    when(mapper.reserveBatch(anyLong())).thenReturn(List.of(row(1L), row(2L)));
    when(mapper.markPublished(1L)).thenThrow(new IllegalStateException("database write failed"));

    new GenerationOutboxDispatcher(mapper, transactionManager).dispatchPending();

    verify(mapper).markPublished(1L);
    verify(mapper).markPublished(2L);
  }

  @Test
  void occupiedGpuLeavesOutboxPendingAndDoesNotBlockOtherRows() {
    GenerationOutboxMapper mapper = mock(GenerationOutboxMapper.class);
    ComputeExecutionDispatcher execution = mock(ComputeExecutionDispatcher.class);
    var first = row(1L);
    var second = row(2L);
    java.util.UUID firstJob = java.util.UUID.randomUUID();
    java.util.UUID secondJob = java.util.UUID.randomUUID();
    first.setAggregateId(firstJob.toString());
    second.setAggregateId(secondJob.toString());
    when(mapper.reserveBatch(anyLong())).thenReturn(List.of(first, second));
    org.mockito.Mockito.doThrow(
            new com.narrativex.backend.feature.generation.domain.exception
                .GenerationAdmissionDeniedException("GPU_CAPACITY", "slot occupied"))
        .when(execution)
        .dispatchJob(firstJob);
    new GenerationOutboxDispatcher(mapper, transactionManager(), execution).dispatchPending();
    verify(mapper, org.mockito.Mockito.never()).markPublished(1L);
    verify(mapper).markPublished(2L);
  }

  private static PlatformTransactionManager transactionManager() {
    PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
    when(transactionManager.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
    return transactionManager;
  }

  private static OutboxDispatchRow row(long id) {
    OutboxDispatchRow row = new OutboxDispatchRow();
    row.setId(id);
    return row;
  }
}
