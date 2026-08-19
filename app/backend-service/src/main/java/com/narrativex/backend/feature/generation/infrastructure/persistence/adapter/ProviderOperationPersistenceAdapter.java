package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import com.narrativex.backend.feature.common.infrastructure.persistence.OptimisticConcurrency;
import com.narrativex.backend.feature.generation.application.port.out.ProviderOperationRepository;
import com.narrativex.backend.feature.generation.domain.entity.ProviderOperation;
import com.narrativex.backend.feature.generation.domain.enums.ProviderOperationStatus;
import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.ProviderOperationJpaEntity;
import com.narrativex.backend.feature.generation.infrastructure.persistence.repository.ProviderOperationJpaRepository;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ProviderOperationPersistenceAdapter implements ProviderOperationRepository {
  private final ProviderOperationJpaRepository repository;

  @Override
  public ProviderOperation save(ProviderOperation operation) {
    ProviderOperationJpaEntity entity =
        operation.getId() == null
            ? build(operation)
            : repository
                .findById(operation.getId())
                .map(
                    existing -> {
                      OptimisticConcurrency.requireVersion(
                          operation.getRowVersion(),
                          existing.getRowVersion(),
                          ProviderOperationJpaEntity.class,
                          operation.getId());
                      apply(existing, operation);
                      return existing;
                    })
                .orElseGet(() -> build(operation));
    return toDomain(repository.save(entity));
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

  private static ProviderOperationJpaEntity build(ProviderOperation operation) {
    return ProviderOperationJpaEntity.builder()
        .stageAttemptId(operation.getStageAttemptId())
        .providerKey(operation.getProviderKey())
        .providerOperationId(operation.getProviderOperationId())
        .status(operation.getStatus())
        .reservedAt(operation.getReservedAt())
        .requestFingerprint(operation.getRequestFingerprint())
        .build();
  }

  private static void apply(ProviderOperationJpaEntity entity, ProviderOperation operation) {
    entity.setStageAttemptId(operation.getStageAttemptId());
    entity.setProviderKey(operation.getProviderKey());
    entity.setProviderOperationId(operation.getProviderOperationId());
    entity.setStatus(operation.getStatus());
    entity.setReservedAt(operation.getReservedAt());
    entity.setRequestFingerprint(operation.getRequestFingerprint());
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
        entity.getRequestFingerprint());
  }
}
