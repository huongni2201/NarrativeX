package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import com.narrativex.backend.feature.generation.application.port.out.ProviderOperationRepository;
import com.narrativex.backend.feature.generation.infrastructure.persistence.adapter.ProviderOperationPersistenceAdapter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(properties = "narrativex.persistence.provider-operation=jpa")
@ActiveProfiles("test")
class ProviderOperationPersistenceSelectionTest {
  @Autowired private ProviderOperationRepository repository;

  @Test
  void jpaRemainsAvailableAsExplicitRollbackImplementation() {
    assertInstanceOf(ProviderOperationPersistenceAdapter.class, repository);
  }
}
