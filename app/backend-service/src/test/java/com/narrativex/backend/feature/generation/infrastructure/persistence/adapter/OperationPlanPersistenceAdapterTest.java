package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.domain.aggregate.OperationPlan;
import com.narrativex.backend.feature.generation.domain.enums.EstimateConfidence;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.OperationPlanMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.OperationPlanRow;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

@ExtendWith(MockitoExtension.class)
class OperationPlanPersistenceAdapterTest {
  @Mock private OperationPlanMapper mapper;

  @Test
  void createsNewPlanWhenDomainIdIsMissing() {
    OperationPlan plan = plan(null, 0L);
    when(mapper.insert(any(OperationPlanRow.class))).thenReturn(11L);
    when(mapper.findById(11L)).thenReturn(row(11L, 0L));
    OperationPlanPersistenceAdapter adapter = new OperationPlanPersistenceAdapter(mapper);

    adapter.save(plan);

    verify(mapper).insert(any(OperationPlanRow.class));
  }

  @Test
  void updatesExistingPlanWithMatchingRowVersion() {
    OperationPlan plan = plan(11L, 3L);
    when(mapper.updateCas(any(OperationPlanRow.class))).thenReturn(1);
    when(mapper.findById(11L)).thenReturn(row(11L, 4L));
    OperationPlanPersistenceAdapter adapter = new OperationPlanPersistenceAdapter(mapper);

    adapter.save(plan);

    verify(mapper).updateCas(any(OperationPlanRow.class));
  }

  @Test
  void rejectsUpdateWhenPersistedPlanIsMissing() {
    OperationPlan plan = plan(11L, 3L);
    when(mapper.updateCas(any(OperationPlanRow.class))).thenReturn(0);
    when(mapper.findById(11L)).thenReturn(null);
    OperationPlanPersistenceAdapter adapter = new OperationPlanPersistenceAdapter(mapper);

    assertThrows(ResourceNotFoundException.class, () -> adapter.save(plan));

    verify(mapper, never()).insert(any(OperationPlanRow.class));
  }

  @Test
  void rejectsUpdateWhenRowVersionIsStale() {
    OperationPlan plan = plan(11L, 3L);
    when(mapper.updateCas(any(OperationPlanRow.class))).thenReturn(0);
    when(mapper.findById(11L)).thenReturn(row(11L, 4L));
    OperationPlanPersistenceAdapter adapter = new OperationPlanPersistenceAdapter(mapper);

    assertThrows(ObjectOptimisticLockingFailureException.class, () -> adapter.save(plan));

    verify(mapper, never()).insert(any(OperationPlanRow.class));
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

  private static OperationPlanRow row(Long id, long rowVersion) {
    return new OperationPlanRow(
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
}
