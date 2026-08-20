package com.narrativex.backend.feature.generation.infrastructure.persistence.repository;

import com.narrativex.backend.feature.generation.domain.enums.ProviderOperationStatus;
import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.ProviderOperationJpaEntity;
import java.util.List;
import java.util.Optional;
import java.time.Instant;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProviderOperationJpaRepository
    extends JpaRepository<ProviderOperationJpaEntity, Long> {
  Optional<ProviderOperationJpaEntity> findByProviderKeyAndRequestFingerprint(
      String providerKey, String requestFingerprint);

  List<ProviderOperationJpaEntity> findByStatus(ProviderOperationStatus status, Pageable pageable);

  List<ProviderOperationJpaEntity> findByStatusInAndNextReconcileAtLessThanEqualOrderByNextReconcileAtAscIdAsc(
      List<ProviderOperationStatus> statuses, Instant nextReconcileAt, Pageable pageable);
}
