package com.narrativex.backend.feature.generation.application.port.out;

import com.narrativex.backend.feature.generation.domain.entity.ProviderOperation;
import com.narrativex.backend.feature.generation.domain.enums.ProviderOperationStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProviderOperationRepository {
  ProviderOperation save(ProviderOperation operation);

  Optional<ProviderOperation> findById(UUID id);

  Optional<ProviderOperation> findByFingerprint(String providerKey, String requestFingerprint);

  List<ProviderOperation> findByStatus(ProviderOperationStatus status, int limit);

  List<ProviderOperation> findDueForReconciliation(
      List<ProviderOperationStatus> statuses, int limit);

  ProviderOperation transition(
      UUID id,
      long expectedVersion,
      ProviderOperationStatus nextStatus,
      String providerOperationId);

  ProviderOperation markSubmissionUnknown(UUID id, long expectedVersion, Instant nextReconcileAt);

  ProviderOperation persistResult(
      UUID id,
      long expectedVersion,
      String providerOperationId,
      String normalizedResultJson,
      String resultFingerprint);

  ProviderOperation recordReconciliationError(
      UUID id, long expectedVersion, String error, Instant nextReconcileAt);
}
