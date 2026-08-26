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
