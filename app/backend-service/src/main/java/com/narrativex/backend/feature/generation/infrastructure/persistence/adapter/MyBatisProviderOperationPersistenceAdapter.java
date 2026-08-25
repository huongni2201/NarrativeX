package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.generation.application.port.out.ProviderOperationRepository;
import com.narrativex.backend.feature.generation.domain.entity.ProviderOperation;
import com.narrativex.backend.feature.generation.domain.enums.ProviderOperationStatus;
import com.narrativex.backend.feature.generation.domain.exception.InvalidProviderOperationTransitionException;
import com.narrativex.backend.feature.generation.domain.exception.ProviderOperationResultConflictException;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProviderOperationMapper;
import com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis.ProviderOperationRow;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class MyBatisProviderOperationPersistenceAdapter implements ProviderOperationRepository {
  private final ProviderOperationMapper mapper;
  private final MeterRegistry meterRegistry;

  @Override
  @Transactional
  public ProviderOperation save(ProviderOperation operation) {
    if (operation.getId() != null) {
      throw new IllegalArgumentException(
          "Existing provider operations must be changed through transition APIs");
    }
    UUID insertedId = mapper.insert(toRow(operation));
    if (insertedId == null) {
      return findByFingerprint(operation.getProviderKey(), operation.getRequestFingerprint())
          .orElseThrow(
              () -> new IllegalStateException("Provider operation reservation disappeared"));
    }
    return findById(insertedId)
        .orElseThrow(() -> new IllegalStateException("Inserted provider operation disappeared"));
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<ProviderOperation> findById(UUID id) {
    return Optional.ofNullable(mapper.findById(id))
        .map(MyBatisProviderOperationPersistenceAdapter::toDomain);
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<ProviderOperation> findByFingerprint(
      String providerKey, String requestFingerprint) {
    return Optional.ofNullable(mapper.findByFingerprint(providerKey, requestFingerprint))
        .map(MyBatisProviderOperationPersistenceAdapter::toDomain);
  }

  @Override
  @Transactional(readOnly = true)
  public List<ProviderOperation> findByStatus(ProviderOperationStatus status, int limit) {
    return mapper.findByStatus(status, Math.max(1, limit)).stream()
        .map(MyBatisProviderOperationPersistenceAdapter::toDomain)
        .toList();
  }

  @Override
  @Transactional(readOnly = true)
  public List<ProviderOperation> findDueForReconciliation(
      List<ProviderOperationStatus> statuses, int limit) {
    if (statuses == null || statuses.isEmpty()) return List.of();
    return mapper.findDue(statuses, Math.max(1, limit)).stream()
        .map(MyBatisProviderOperationPersistenceAdapter::toDomain)
        .toList();
  }

  @Override
  @Transactional
  public ProviderOperation transition(
      UUID id,
      long expectedVersion,
      ProviderOperationStatus nextStatus,
      String providerOperationId) {
    ProviderOperation current = require(id);
    requireTransition(current, nextStatus);
    int affected =
        mapper.transition(
            id,
            List.copyOf(ProviderOperation.allowedPreviousStatuses(nextStatus)),
            nextStatus,
            providerOperationId,
            expectedVersion);
    if (affected != 1) {
      increment("provider_operation.transition.conflict");
      throw optimisticConflict(id);
    }
    increment("provider_operation.transition.success");
    return require(id);
  }

  @Override
  @Transactional
  public ProviderOperation markSubmissionUnknown(
      UUID id, long expectedVersion, Instant nextReconcileAt) {
    ProviderOperation current = require(id);
    requireTransition(current, ProviderOperationStatus.UNKNOWN);
    if (mapper.markSubmissionUnknown(id, expectedVersion, nextReconcileAt) != 1) {
      increment("provider_operation.transition.conflict");
      throw optimisticConflict(id);
    }
    increment("provider_operation.transition.success");
    return require(id);
  }

  @Override
  @Transactional
  public ProviderOperation persistResult(
      UUID id,
      long expectedVersion,
      String providerOperationId,
      String normalizedResultJson,
      String resultFingerprint) {
    if (normalizedResultJson == null || normalizedResultJson.isBlank())
      throw new IllegalArgumentException("normalizedResultJson must not be blank");
    if (resultFingerprint == null || resultFingerprint.isBlank())
      throw new IllegalArgumentException("resultFingerprint must not be blank");

    ProviderOperation current = require(id);
    if (current.getStatus() == ProviderOperationStatus.COMPLETED)
      return resolveCompletedResult(current, resultFingerprint);
    requireTransition(current, ProviderOperationStatus.COMPLETED);
    int affected =
        mapper.persistResult(
            id, expectedVersion, providerOperationId, normalizedResultJson, resultFingerprint);
    if (affected != 1) {
      ProviderOperation latest = require(id);
      if (latest.getStatus() == ProviderOperationStatus.COMPLETED)
        return resolveCompletedResult(latest, resultFingerprint);
      increment("provider_operation.transition.conflict");
      throw optimisticConflict(id);
    }
    increment("provider_operation.transition.success");
    return require(id);
  }

  @Override
  @Transactional
  public ProviderOperation recordReconciliationError(
      UUID id, long expectedVersion, String error, Instant nextReconcileAt) {
    if (require(id).getStatus().isTerminal()) {
      throw new InvalidProviderOperationTransitionException(
          "Provider operation " + id + " cannot record reconciliation metadata after termination");
    }
    if (mapper.recordReconciliationError(id, expectedVersion, error, nextReconcileAt) != 1) {
      increment("provider_operation.transition.conflict");
      throw optimisticConflict(id);
    }
    increment("provider_operation.transition.success");
    return require(id);
  }

  private ProviderOperation require(UUID id) {
    return findById(id).orElseThrow(() -> optimisticConflict(id));
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

  private ProviderOperation resolveCompletedResult(
      ProviderOperation current, String resultFingerprint) {
    if (resultFingerprint.equals(current.getResultFingerprint())) {
      increment("provider_operation.result.idempotent");
      return current;
    }
    increment("provider_operation.result.conflict");
    throw new ProviderOperationResultConflictException(
        "Provider operation " + current.getId() + " already has a different result");
  }

  private void increment(String metricName) {
    meterRegistry.counter(metricName).increment();
  }

  private static OptimisticLockingFailureException optimisticConflict(UUID id) {
    return new OptimisticLockingFailureException(
        "Provider operation " + id + " was modified concurrently");
  }

  private static ProviderOperationRow toRow(ProviderOperation operation) {
    return new ProviderOperationRow(
        operation.getId(),
        operation.getRowVersion(),
        operation.getStageAttemptId(),
        operation.getProviderKey(),
        operation.getProviderOperationId(),
        operation.getStatus(),
        operation.getRequestFingerprint(),
        operation.getNormalizedResultJson(),
        operation.getResultFingerprint(),
        operation.getReservedAt(),
        operation.getCompletedAt(),
        operation.getNextReconcileAt(),
        operation.getReconcileAttempts(),
        operation.getLastReconcileError());
  }

  private static ProviderOperation toDomain(ProviderOperationRow row) {
    return ProviderOperation.rehydrate(
        row.getId(),
        row.getRowVersion(),
        row.getStageAttemptId(),
        row.getProviderKey(),
        row.getProviderOperationId(),
        row.getStatus(),
        row.getReservedAt(),
        row.getRequestFingerprint(),
        row.getNormalizedResultJson(),
        row.getResultFingerprint(),
        row.getCompletedAt(),
        row.getNextReconcileAt(),
        row.getReconcileAttempts(),
        row.getLastReconcileError());
  }
}
