package com.narrativex.backend.feature.generation.infrastructure.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import com.narrativex.backend.feature.generation.application.port.out.ProviderOperationRepository;
import com.narrativex.backend.feature.generation.infrastructure.persistence.adapter.MyBatisProviderOperationPersistenceAdapter;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class ProviderOperationDefaultPersistenceSelectionTest {
  @Autowired private ApplicationContext applicationContext;
  @Autowired private ProviderOperationRepository repository;

  @Test
  void propertyAbsentSelectsExactlyOneMyBatisAdapter() {
    Map<String, ProviderOperationRepository> adapters =
        applicationContext.getBeansOfType(ProviderOperationRepository.class);

    assertEquals(1, adapters.size());
    assertInstanceOf(MyBatisProviderOperationPersistenceAdapter.class, repository);
  }
}
