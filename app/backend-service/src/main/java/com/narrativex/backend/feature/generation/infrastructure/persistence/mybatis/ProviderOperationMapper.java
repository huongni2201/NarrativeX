package com.narrativex.backend.feature.generation.infrastructure.persistence.mybatis;

import com.narrativex.backend.feature.common.infrastructure.persistence.mybatis.NarrativeXMyBatisMapper;
import com.narrativex.backend.feature.generation.domain.enums.ProviderOperationStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.apache.ibatis.annotations.Param;

public interface ProviderOperationMapper extends NarrativeXMyBatisMapper {
  UUID insert(ProviderOperationRow row);

  ProviderOperationRow findById(@Param("id") UUID id);

  ProviderOperationRow findByFingerprint(
      @Param("providerKey") String providerKey,
      @Param("requestFingerprint") String requestFingerprint);

  List<ProviderOperationRow> findByStatus(
      @Param("status") ProviderOperationStatus status, @Param("limit") int limit);

  List<ProviderOperationRow> findDue(
      @Param("statuses") List<ProviderOperationStatus> statuses, @Param("limit") int limit);

  int transition(
      @Param("id") UUID id,
      @Param("allowedPrevious") List<ProviderOperationStatus> allowedPrevious,
      @Param("nextStatus") ProviderOperationStatus nextStatus,
      @Param("providerOperationId") String providerOperationId,
      @Param("expectedVersion") long expectedVersion);

  int markSubmissionUnknown(
      @Param("id") UUID id,
      @Param("expectedVersion") long expectedVersion,
      @Param("nextReconcileAt") Instant nextReconcileAt);

  int persistResult(
      @Param("id") UUID id,
      @Param("expectedVersion") long expectedVersion,
      @Param("providerOperationId") String providerOperationId,
      @Param("normalizedResultJson") String normalizedResultJson,
      @Param("resultFingerprint") String resultFingerprint);

  int recordReconciliationError(
      @Param("id") UUID id,
      @Param("expectedVersion") long expectedVersion,
      @Param("error") String error,
      @Param("nextReconcileAt") Instant nextReconcileAt);
}
