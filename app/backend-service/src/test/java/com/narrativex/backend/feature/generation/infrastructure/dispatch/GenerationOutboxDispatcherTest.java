package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
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
  void batchesWakeupHintsByChannelWhilePublishingEveryDurableOutboxRow() {
    GenerationOutboxMapper mapper = mock(GenerationOutboxMapper.class);
    PostgresGenerationHintPublisher publisher = mock(PostgresGenerationHintPublisher.class);
    PlatformTransactionManager transactionManager = mock(PlatformTransactionManager.class);
    when(transactionManager.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
    when(mapper.reserveBatch(anyLong()))
        .thenReturn(
            List.of(
                row(1L, "GENERATION_JOB_QUEUED"),
                row(2L, "GENERATION_JOB_QUEUED"),
                row(3L, "MEDIA_VALIDATION_REQUESTED")));

    new GenerationOutboxDispatcher(mapper, publisher, transactionManager).dispatchPending();

    verify(publisher).publish(GenerationOutboxDispatcher.CHANNEL, 2L);
    verify(publisher).publish(GenerationOutboxDispatcher.MEDIA_VALIDATION_CHANNEL, 3L);
    verify(publisher, times(2)).publish(any(), anyLong());
    verify(mapper).markPublished(1L);
    verify(mapper).markPublished(2L);
    verify(mapper).markPublished(3L);
  }

  private static OutboxDispatchRow row(long id, String eventType) {
    OutboxDispatchRow row = new OutboxDispatchRow();
    row.setId(id);
    row.setEventType(eventType);
    return row;
  }
}
