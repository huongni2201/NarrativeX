package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import com.narrativex.backend.feature.generation.application.port.out.ProviderOperationRepository;
import com.narrativex.backend.feature.generation.domain.entity.ProviderOperation;
import com.narrativex.backend.feature.generation.domain.enums.ProviderOperationStatus;
import com.narrativex.backend.feature.generation.domain.exception.InvalidProviderOperationTransitionException;
import com.narrativex.backend.feature.generation.domain.exception.ProviderOperationResultConflictException;
import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.ProviderOperationJpaEntity;
import com.narrativex.backend.feature.generation.infrastructure.persistence.repository.ProviderOperationJpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = "narrativex.persistence.provider-operation", havingValue = "jpa")
public class ProviderOperationPersistenceAdapter implements ProviderOperationRepository {
  private final ProviderOperationJpaRepository repository;

  @Override
  public ProviderOperation save(ProviderOperation operation) {
    if (operation.getId() == null && operation.getRequestFingerprint() != null) {
      Optional<ProviderOperation> existing =
          findByFingerprint(operation.getProviderKey(), operation.getRequestFingerprint());
      if (existing.isPresent()) return existing.get();
    }
    ProviderOperationJpaEntity entity;
    if (operation.getId() == null) {
      entity = build(operation);
    } else {
      entity =
          repository
              .findById(operation.getId())
              .orElseThrow(
                  () ->
                      new ResourceNotFoundException(
                          "ProviderOperation "
                              + operation.getId()
                              + " no longer exists while applying an update"));
      OptimisticConcurrency.requireVersion(
          operation.getRowVersion(),
          entity.getRowVersion(),
          ProviderOperationJpaEntity.class,
          operation.getId());
      apply(entity, operation);
    }
    return toDomain(repository.saveAndFlush(entity));
  }

  @Override
  public Optional<ProviderOperation> findById(Long id) {
    return repository.findById(id).map(ProviderOperationPersistenceAdapter::toDomain);
  }

  @Override
  public Optional<ProviderOperation> findByFingerprint(
      String providerKey, String requestFingerprint) {
    return repository
        .findByProviderKeyAndRequestFingerprint(providerKey, requestFingerprint)
        .map(ProviderOperationPersistenceAdapter::toDomain);
  }

  @Override
  public List<ProviderOperation> findByStatus(ProviderOperationStatus status, int limit) {
    return repository.findByStatus(status, PageRequest.of(0, Math.max(1, limit))).stream()
        .map(ProviderOperationPersistenceAdapter::toDomain)
        .toList();
  }

  @Override
  public List<ProviderOperation> findDueForReconciliation(
      List<ProviderOperationStatus> statuses, int limit) {
    return repository
        .findByStatusInAndNextReconcileAtLessThanEqualOrderByNextReconcileAtAscIdAsc(
            statuses, Instant.now(), PageRequest.of(0, Math.max(1, limit)))
        .stream()
        .map(ProviderOperationPersistenceAdapter::toDomain)
        .toList();
  }

  @Override
  public ProviderOperation transition(
      Long id, long expectedVersion, ProviderOperationStatus nextStatus, String providerOperationId) {
    ProviderOperationJpaEntity entity = requireEntity(id);
    ProviderOperation current = toDomain(entity);
    requireTransition(current, nextStatus);
    OptimisticConcurrency.requireVersion(
        expectedVersion, current.getRowVersion(), ProviderOperationJpaEntity.class, id);
    entity.setStatus(nextStatus);
    if (providerOperationId != null) entity.setProviderOperationId(providerOperationId);
    return toDomain(repository.saveAndFlush(entity));
  }

  @Override
  public ProviderOperation markSubmissionUnknown(
      Long id, long expectedVersion, Instant nextReconcileAt) {
    ProviderOperationJpaEntity entity = requireEntity(id);
    ProviderOperation current = toDomain(entity);
    requireTransition(current, ProviderOperationStatus.UNKNOWN);
    OptimisticConcurrency.requireVersion(
        expectedVersion, current.getRowVersion(), ProviderOperationJpaEntity.class, id);
    entity.setStatus(ProviderOperationStatus.UNKNOWN);
    entity.setNextReconcileAt(nextReconcileAt);
    entity.setLastReconcileError(null);
    return toDomain(repository.saveAndFlush(entity));
  }

  @Override
  public ProviderOperation persistResult(
      Long id,
      long expectedVersion,
      String providerOperationId,
      String normalizedResultJson,
      String resultFingerprint) {
    if (normalizedResultJson == null || normalizedResultJson.isBlank()) {
      throw new IllegalArgumentException("normalizedResultJson must not be blank");
    }
    if (resultFingerprint == null || resultFingerprint.isBlank()) {
      throw new IllegalArgumentException("resultFingerprint must not be blank");
    }
    ProviderOperationJpaEntity entity = requireEntity(id);
    ProviderOperation current = toDomain(entity);
    if (current.getStatus() == ProviderOperationStatus.COMPLETED) {
      return requireSameResult(current, resultFingerprint);
    }
    requireTransition(current, ProviderOperationStatus.COMPLETED);
    OptimisticConcurrency.requireVersion(
        expectedVersion, current.getRowVersion(), ProviderOperationJpaEntity.class, id);
    entity.setStatus(ProviderOperationStatus.COMPLETED);
    if (providerOperationId != null) entity.setProviderOperationId(providerOperationId);
    entity.setNormalizedResultJson(normalizedResultJson);
    entity.setResultFingerprint(resultFingerprint);
    entity.setCompletedAt(Instant.now());
    entity.setNextReconcileAt(null);
    return toDomain(repository.saveAndFlush(entity));
  }

  @Override
  public ProviderOperation recordReconciliationError(
      Long id, long expectedVersion, String error, Instant nextReconcileAt) {
    ProviderOperationJpaEntity entity = requireEntity(id);
    ProviderOperation current = toDomain(entity);
    if (current.getStatus().isTerminal()) {
      throw new InvalidProviderOperationTransitionException(
          "Provider operation " + id + " cannot record reconciliation metadata after termination");
    }
    OptimisticConcurrency.requireVersion(
        expectedVersion, current.getRowVersion(), ProviderOperationJpaEntity.class, id);
    entity.setReconcileAttempts(current.getReconcileAttempts() + 1);
    entity.setNextReconcileAt(nextReconcileAt);
    entity.setLastReconcileError(error);
    return toDomain(repository.saveAndFlush(entity));
  }

  private static ProviderOperationJpaEntity build(ProviderOperation operation) {
    return ProviderOperationJpaEntity.builder()
        .stageAttemptId(operation.getStageAttemptId())
        .providerKey(operation.getProviderKey())
        .providerOperationId(operation.getProviderOperationId())
        .status(operation.getStatus())
        .reservedAt(operation.getReservedAt())
        .requestFingerprint(operation.getRequestFingerprint())
        .normalizedResultJson(operation.getNormalizedResultJson())
        .resultFingerprint(operation.getResultFingerprint())
        .completedAt(operation.getCompletedAt())
        .nextReconcileAt(operation.getNextReconcileAt())
        .reconcileAttempts(operation.getReconcileAttempts())
        .lastReconcileError(operation.getLastReconcileError())
        .build();
  }

  private static void apply(ProviderOperationJpaEntity entity, ProviderOperation operation) {
    entity.setStageAttemptId(operation.getStageAttemptId());
    entity.setProviderKey(operation.getProviderKey());
    entity.setProviderOperationId(operation.getProviderOperationId());
    entity.setStatus(operation.getStatus());
    entity.setReservedAt(operation.getReservedAt());
    entity.setRequestFingerprint(operation.getRequestFingerprint());
    entity.setNormalizedResultJson(operation.getNormalizedResultJson());
    entity.setResultFingerprint(operation.getResultFingerprint());
    entity.setCompletedAt(operation.getCompletedAt());
    entity.setNextReconcileAt(operation.getNextReconcileAt());
    entity.setReconcileAttempts(operation.getReconcileAttempts());
    entity.setLastReconcileError(operation.getLastReconcileError());
  }

  private static ProviderOperation toDomain(ProviderOperationJpaEntity entity) {
    return ProviderOperation.rehydrate(
        entity.getId(),
        entity.getRowVersion(),
        entity.getStageAttemptId(),
        entity.getProviderKey(),
        entity.getProviderOperationId(),
        entity.getStatus(),
        entity.getReservedAt(),
        entity.getRequestFingerprint(),
        entity.getNormalizedResultJson(),
        entity.getResultFingerprint(),
        entity.getCompletedAt(),
        entity.getNextReconcileAt(),
        entity.getReconcileAttempts(),
        entity.getLastReconcileError());
  }

  private ProviderOperationJpaEntity requireEntity(Long id) {
    return repository
        .findById(id)
        .orElseThrow(() -> new ObjectOptimisticLockingFailureException(
            ProviderOperationJpaEntity.class, id));
  }

  private static void requireTransition(
      ProviderOperation current, ProviderOperationStatus nextStatus) {
    if (!current.canTransitionTo(nextStatus)) {
      throw new InvalidProviderOperationTransitionException(
          "Provider operation "
              + current.getId()
              + " cannot transition from "
              + current.getStatus()
              + " to "
              + nextStatus);
    }
  }

  private static ProviderOperation requireSameResult(
      ProviderOperation current, String resultFingerprint) {
    if (resultFingerprint != null && resultFingerprint.equals(current.getResultFingerprint())) {
      return current;
    }
    throw new ProviderOperationResultConflictException(
        "Provider operation " + current.getId() + " already has a different result");
  }
}
