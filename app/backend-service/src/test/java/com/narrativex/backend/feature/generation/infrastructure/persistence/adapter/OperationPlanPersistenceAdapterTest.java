package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.enums.EstimateConfidence;
import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.OperationPlanJpaEntity;
import com.narrativex.backend.feature.generation.infrastructure.persistence.repository.OperationPlanJpaRepository;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

@ExtendWith(MockitoExtension.class)
class OperationPlanPersistenceAdapterTest {
  @Mock private OperationPlanJpaRepository repository;

  @Test
  void createsNewPlanWhenDomainIdIsMissing() {
    OperationPlan plan = plan(null, 0L);
    when(repository.save(any(OperationPlanJpaEntity.class)))
        .thenAnswer(
            invocation -> {
              OperationPlanJpaEntity entity = invocation.getArgument(0);
              entity.setId(11L);
              return entity;
            });
    OperationPlanPersistenceAdapter adapter = new OperationPlanPersistenceAdapter(repository);

    adapter.save(plan);

    verify(repository, never()).findById(any());
    verify(repository).save(any(OperationPlanJpaEntity.class));
  }

  @Test
  void updatesExistingPlanWithMatchingRowVersion() {
    OperationPlan plan = plan(11L, 3L);
    OperationPlanJpaEntity persisted = persistedPlan(11L, 3L);
    when(repository.findById(11L)).thenReturn(Optional.of(persisted));
    when(repository.save(persisted)).thenReturn(persisted);
    OperationPlanPersistenceAdapter adapter = new OperationPlanPersistenceAdapter(repository);

    adapter.save(plan);

    verify(repository).save(persisted);
  }

  @Test
  void rejectsUpdateWhenPersistedPlanIsMissing() {
    OperationPlan plan = plan(11L, 3L);
    when(repository.findById(11L)).thenReturn(Optional.empty());
    OperationPlanPersistenceAdapter adapter = new OperationPlanPersistenceAdapter(repository);

    assertThrows(ResourceNotFoundException.class, () -> adapter.save(plan));

    verify(repository, never()).save(any(OperationPlanJpaEntity.class));
  }

  @Test
  void rejectsUpdateWhenRowVersionIsStale() {
    OperationPlan plan = plan(11L, 3L);
    OperationPlanJpaEntity persisted = persistedPlan(11L, 4L);
    when(repository.findById(11L)).thenReturn(Optional.of(persisted));
    OperationPlanPersistenceAdapter adapter = new OperationPlanPersistenceAdapter(repository);

    assertThrows(ObjectOptimisticLockingFailureException.class, () -> adapter.save(plan));

    verify(repository, never()).save(any(OperationPlanJpaEntity.class));
  }

  private static OperationPlan plan(Long id, long rowVersion) {
    return OperationPlan.rehydrate(
        id,
        rowVersion,
        7L,
        12L,
        "CHAPTER_ANALYZE",
        BigDecimal.ONE,
        BigDecimal.TEN,
        BigDecimal.TEN,
        EstimateConfidence.HIGH);
  }

  private static OperationPlanJpaEntity persistedPlan(Long id, long rowVersion) {
    OperationPlanJpaEntity entity =
        OperationPlanJpaEntity.builder()
            .projectId(7L)
            .generationJobId(12L)
            .operationType("CHAPTER_ANALYZE")
            .estimateMin(BigDecimal.ONE)
            .estimateMax(BigDecimal.TEN)
            .maxAuthorizedCost(BigDecimal.TEN)
            .confidence(EstimateConfidence.HIGH)
            .build();
    entity.setId(id);
    entity.setRowVersion(rowVersion);
    return entity;
  }
}
