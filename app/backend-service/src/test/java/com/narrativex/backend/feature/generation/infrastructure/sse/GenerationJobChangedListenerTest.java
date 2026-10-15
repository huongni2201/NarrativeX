package com.narrativex.backend.feature.generation.infrastructure.sse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.narrativex.backend.feature.generation.application.event.GenerationJobChangedEvent;
import com.narrativex.backend.feature.generation.application.service.GenerationJobEventBroadcaster;
import com.narrativex.backend.feature.generation.domain.aggregate.GenerationJob;
import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.domain.enums.ResourceClass;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Verifies the commit-ordering contract of {@link GenerationJobChangedListener} against Spring's
 * real transaction synchronization, using a no-op transaction manager so the contract does not
 * depend on a database.
 */
class GenerationJobChangedListenerTest {

  private AnnotationConfigApplicationContext context;
  private GenerationJobEventBroadcaster broadcaster;
  private TransactionTemplate transactions;

  @BeforeEach
  void setUp() {
    broadcaster = mock(GenerationJobEventBroadcaster.class);
    context = new AnnotationConfigApplicationContext();
    context.register(TransactionSupportConfig.class);
    context.registerBean(
        "transactionManager", PlatformTransactionManager.class, NoopTransactionManager::new);
    context.registerBean(
        GenerationJobChangedListener.class, () -> new GenerationJobChangedListener(broadcaster));
    context.refresh();
    transactions = new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
  }

  @AfterEach
  void tearDown() {
    context.close();
  }

  private static GenerationJobChangedEvent newEvent() {
    return new GenerationJobChangedEvent(
        GenerationJob.create(
            UUID.randomUUID(), JobType.CHAPTER_GENERATE, ResourceClass.PROVIDER_BATCH));
  }

  @Test
  void broadcastsOnlyAfterTransactionCommits() {
    var event = newEvent();

    transactions.executeWithoutResult(
        status -> {
          context.publishEvent(event);
          verify(broadcaster, never()).broadcastJobEvent(any());
        });

    verify(broadcaster, times(1)).broadcastJobEvent(event.job());
  }

  @Test
  void doesNotBroadcastWhenTransactionRollsBack() {
    var event = newEvent();

    transactions.executeWithoutResult(
        status -> {
          context.publishEvent(event);
          status.setRollbackOnly();
        });

    verify(broadcaster, never()).broadcastJobEvent(any());
  }

  @Test
  void doesNotBroadcastWhenTransactionBodyThrows() {
    var event = newEvent();

    assertThatCode(
            () ->
                transactions.executeWithoutResult(
                    status -> {
                      context.publishEvent(event);
                      throw new IllegalStateException("finalizer failed");
                    }))
        .isInstanceOf(IllegalStateException.class);

    verify(broadcaster, never()).broadcastJobEvent(any());
  }

  @Test
  void broadcastsImmediatelyWhenNoTransactionIsActive() {
    var event = newEvent();

    context.publishEvent(event);

    verify(broadcaster, times(1)).broadcastJobEvent(event.job());
  }

  @Test
  void broadcastFailureDoesNotPropagateToCommittedWork() {
    var event = newEvent();
    doThrow(new IllegalStateException("dead emitter")).when(broadcaster).broadcastJobEvent(any());
    var committed = new boolean[] {false};

    assertThatCode(
            () ->
                transactions.executeWithoutResult(
                    status -> {
                      context.publishEvent(event);
                      committed[0] = true;
                    }))
        .doesNotThrowAnyException();

    assertThat(committed[0]).isTrue();
    verify(broadcaster, times(1)).broadcastJobEvent(event.job());
  }

  @Configuration
  @EnableTransactionManagement
  static class TransactionSupportConfig {}

  private static final class NoopTransactionManager extends AbstractPlatformTransactionManager {
    @Override
    protected Object doGetTransaction() {
      return new Object();
    }

    @Override
    protected void doBegin(Object transaction, TransactionDefinition definition) {}

    @Override
    protected void doCommit(DefaultTransactionStatus status) {}

    @Override
    protected void doRollback(DefaultTransactionStatus status) {}
  }
}
