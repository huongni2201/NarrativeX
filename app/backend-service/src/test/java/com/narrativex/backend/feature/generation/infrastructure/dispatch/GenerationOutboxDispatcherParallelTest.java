package com.narrativex.backend.feature.generation.infrastructure.dispatch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.domain.enums.JobType;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.GenerationOutboxMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.OutboxDispatchRow;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;

class GenerationOutboxDispatcherParallelTest {
  private GenerationOutboxMapper mapper;
  private ComputeExecutionDispatcher execution;
  private GenerationDispatchProperties properties;
  private GenerationDispatchExecutor lanes;
  private GenerationJobHandlerRegistry registry;
  private SimpleMeterRegistry meters;
  private GenerationOutboxDispatcher dispatcher;

  @BeforeEach
  void setUp() {
    mapper = mock(GenerationOutboxMapper.class);
    execution = mock(ComputeExecutionDispatcher.class);
    properties = new GenerationDispatchProperties();
    properties.setParallelEnabled(true);
    properties.getLanes().setAnalysis(1);
    properties.getLanes().setMedia(2);
    properties.setShutdownTimeout(Duration.ofSeconds(2));
    properties.setReservation(Duration.ofSeconds(30));
    properties.setAnalysisLease(Duration.ofMinutes(17));
    properties.setMediaLease(Duration.ofMinutes(5));
    @SuppressWarnings("unchecked")
    ObjectProvider<io.micrometer.core.instrument.MeterRegistry> provider =
        mock(ObjectProvider.class);
    lanes = new GenerationDispatchExecutor(properties, provider);
    registry = new GenerationJobHandlerRegistry(List.of(analysisHandler()));
    meters = new SimpleMeterRegistry();
    dispatcher =
        new GenerationOutboxDispatcher(mapper, transactionManager(), execution)
            .withLanes(properties, lanes, registry, meters);
  }

  @AfterEach
  void tearDown() {
    lanes.shutdown();
  }

  @Test
  void slowAnalysisDoesNotDelayMediaDispatch() throws Exception {
    UUID analysisJob = UUID.randomUUID();
    UUID mediaJob = UUID.randomUUID();
    var release = new CountDownLatch(1);
    var analysisStarted = new CountDownLatch(1);
    doAnswer(
            invocation -> {
              analysisStarted.countDown();
              release.await(10, TimeUnit.SECONDS);
              return null;
            })
        .when(execution)
        .dispatchJob(analysisJob);
    when(mapper.reserveLaneBatch(anyLong(), anyInt(), anyInt(), anyList()))
        .thenReturn(List.of(row(1, analysisJob, "ANALYSIS"), row(2, mediaJob, "MEDIA")));

    dispatcher.dispatchPending();

    assertThat(analysisStarted.await(2, TimeUnit.SECONDS)).isTrue();
    verify(mapper, timeout(2000)).markPublished(2L);
    verify(mapper, never()).markPublished(1L);

    release.countDown();
    verify(mapper, timeout(2000)).markPublished(1L);
  }

  @Test
  void reservesOnlyAsManyRowsAsEachLaneHasFreePermits() throws Exception {
    UUID analysisJob = UUID.randomUUID();
    var release = new CountDownLatch(1);
    var started = new CountDownLatch(1);
    doAnswer(
            invocation -> {
              started.countDown();
              release.await(10, TimeUnit.SECONDS);
              return null;
            })
        .when(execution)
        .dispatchJob(analysisJob);
    when(mapper.reserveLaneBatch(anyLong(), anyInt(), anyInt(), anyList()))
        .thenReturn(List.of(row(1, analysisJob, "ANALYSIS")))
        .thenReturn(List.of());

    dispatcher.dispatchPending();
    assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();
    dispatcher.dispatchPending();

    var analysisLimit = ArgumentCaptor.forClass(Integer.class);
    var mediaLimit = ArgumentCaptor.forClass(Integer.class);
    verify(mapper, times(2))
        .reserveLaneBatch(anyLong(), analysisLimit.capture(), mediaLimit.capture(), anyList());
    assertThat(analysisLimit.getAllValues()).containsExactly(1, 0);
    assertThat(mediaLimit.getAllValues()).containsExactly(2, 2);

    release.countDown();
  }

  @Test
  void skipsReservingWhenEveryLaneIsSaturated() throws Exception {
    var release = new CountDownLatch(1);
    var started = new CountDownLatch(3);
    doAnswer(
            invocation -> {
              started.countDown();
              release.await(10, TimeUnit.SECONDS);
              return null;
            })
        .when(execution)
        .dispatchJob(any());
    when(mapper.reserveLaneBatch(anyLong(), anyInt(), anyInt(), anyList()))
        .thenReturn(
            List.of(
                row(1, UUID.randomUUID(), "ANALYSIS"),
                row(2, UUID.randomUUID(), "MEDIA"),
                row(3, UUID.randomUUID(), "MEDIA")))
        .thenReturn(List.of());

    dispatcher.dispatchPending();
    assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();
    dispatcher.dispatchPending();

    verify(mapper, times(1)).reserveLaneBatch(anyLong(), anyInt(), anyInt(), anyList());
    release.countDown();
  }

  @Test
  void extendsTheLeaseByLaneBeforeRunningTheHandler() {
    UUID analysisJob = UUID.randomUUID();
    UUID mediaJob = UUID.randomUUID();
    when(mapper.reserveLaneBatch(anyLong(), anyInt(), anyInt(), anyList()))
        .thenReturn(List.of(row(1, analysisJob, "ANALYSIS"), row(2, mediaJob, "MEDIA")));

    dispatcher.dispatchPending();

    verify(mapper, timeout(2000)).extendReservation(1L, Duration.ofMinutes(17).toMillis());
    verify(mapper, timeout(2000)).extendReservation(2L, Duration.ofMinutes(5).toMillis());
    verify(mapper, timeout(2000)).markPublished(1L);
    verify(mapper, timeout(2000)).markPublished(2L);
  }

  @Test
  void failedDispatchGoesBackToTheShortRetryWindowAndStaysPending() {
    UUID mediaJob = UUID.randomUUID();
    doThrow(
            new com.narrativex.backend.feature.generation.domain.exception
                .GenerationAdmissionDeniedException("GPU_CAPACITY", "slot occupied"))
        .when(execution)
        .dispatchJob(mediaJob);
    when(mapper.reserveLaneBatch(anyLong(), anyInt(), anyInt(), anyList()))
        .thenReturn(List.of(row(5, mediaJob, "MEDIA")));

    dispatcher.dispatchPending();

    verify(mapper, timeout(2000)).extendReservation(5L, Duration.ofSeconds(30).toMillis());
    verify(mapper, never()).markPublished(5L);
  }

  @Test
  void aRowStillRunningIsLeasedAgainInsteadOfDispatchedTwice() throws Exception {
    UUID mediaJob = UUID.randomUUID();
    var release = new CountDownLatch(1);
    var started = new CountDownLatch(1);
    doAnswer(
            invocation -> {
              started.countDown();
              release.await(10, TimeUnit.SECONDS);
              return null;
            })
        .when(execution)
        .dispatchJob(mediaJob);
    // The same row comes back because its reservation lapsed while its handler is still running.
    when(mapper.reserveLaneBatch(anyLong(), anyInt(), anyInt(), anyList()))
        .thenReturn(List.of(row(2, mediaJob, "MEDIA")))
        .thenReturn(List.of(row(2, mediaJob, "MEDIA")));

    dispatcher.dispatchPending();
    assertThat(started.await(2, TimeUnit.SECONDS)).isTrue();
    dispatcher.dispatchPending();

    verify(execution, times(1)).dispatchJob(mediaJob);
    verify(mapper, timeout(2000).times(2)).extendReservation(2L, Duration.ofMinutes(5).toMillis());
    release.countDown();
  }

  @Test
  void recordsOutboxDispatchLatencyWhenTheHandlerStarts() {
    UUID mediaJob = UUID.randomUUID();
    var row = row(9, mediaJob, "MEDIA");
    row.setCreatedAt(Instant.now().minusSeconds(3));
    when(mapper.reserveLaneBatch(anyLong(), anyInt(), anyInt(), anyList()))
        .thenReturn(List.of(row));

    dispatcher.dispatchPending();

    verify(execution, timeout(2000)).dispatchJob(mediaJob);
    var timer = meters.find("narrativex.outbox.dispatch.latency").timer();
    assertThat(timer).isNotNull();
    assertThat(timer.count()).isEqualTo(1);
    assertThat(timer.totalTime(TimeUnit.MILLISECONDS)).isGreaterThanOrEqualTo(3000);
  }

  @Test
  void classifiesAnalysisJobTypesFromTheHandlerLanes() {
    when(mapper.reserveLaneBatch(anyLong(), anyInt(), anyInt(), anyList())).thenReturn(List.of());

    dispatcher.dispatchPending();

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<String>> types = ArgumentCaptor.forClass(List.class);
    verify(mapper).reserveLaneBatch(eq(30_000L), eq(1), eq(2), types.capture());
    assertThat(types.getValue()).containsExactly(JobType.CHAPTER_ANALYZE.name());
  }

  @Test
  void stayingSequentialWhenTheFlagIsOffNeverTouchesTheLaneQueries() {
    properties.setParallelEnabled(false);
    when(mapper.reserveBatch(anyLong())).thenReturn(List.of());

    dispatcher.dispatchPending();

    verify(mapper).reserveBatch(anyLong());
    verify(mapper, never()).reserveLaneBatch(anyLong(), anyInt(), anyInt(), anyList());
  }

  private static GenerationJobHandler analysisHandler() {
    return new GenerationJobHandler() {
      @Override
      public JobType supportedType() {
        return JobType.CHAPTER_ANALYZE;
      }

      @Override
      public void execute(UUID jobId) {}

      @Override
      public DispatchLane lane() {
        return DispatchLane.ANALYSIS;
      }
    };
  }

  private static OutboxDispatchRow row(long id, UUID aggregateId, String lane) {
    var row = new OutboxDispatchRow();
    row.setId(id);
    row.setAggregateId(aggregateId.toString());
    row.setLane(lane);
    return row;
  }

  private static PlatformTransactionManager transactionManager() {
    PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
    when(manager.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
    return manager;
  }
}
