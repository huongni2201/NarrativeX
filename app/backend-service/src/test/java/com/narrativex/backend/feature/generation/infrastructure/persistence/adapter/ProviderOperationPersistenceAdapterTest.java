package com.narrativex.backend.feature.generation.infrastructure.persistence.adapter;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.generation.domain.entity.ProviderOperation;
import com.narrativex.backend.feature.generation.domain.enums.ProviderOperationStatus;
import com.narrativex.backend.feature.generation.infrastructure.persistence.entity.ProviderOperationJpaEntity;
import com.narrativex.backend.feature.generation.infrastructure.persistence.repository.ProviderOperationJpaRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProviderOperationPersistenceAdapterTest {
  @Mock private ProviderOperationJpaRepository repository;

  @Test
  void rejectsUpdateWhenPersistedProviderOperationIsMissing() {
    ProviderOperation operation =
        ProviderOperation.rehydrate(
            11L,
            3L,
            7L,
            "vertex",
            null,
            ProviderOperationStatus.RESERVED,
            Instant.parse("2026-01-01T00:00:00Z"),
            "fingerprint");
    when(repository.findById(11L)).thenReturn(Optional.empty());
    ProviderOperationPersistenceAdapter adapter = new ProviderOperationPersistenceAdapter(repository);

    assertThrows(ResourceNotFoundException.class, () -> adapter.save(operation));

    verify(repository, never()).saveAndFlush(any(ProviderOperationJpaEntity.class));
  }
}
