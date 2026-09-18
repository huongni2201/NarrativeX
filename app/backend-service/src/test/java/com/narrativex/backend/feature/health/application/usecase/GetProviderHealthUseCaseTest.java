package com.narrativex.backend.feature.health.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.health.application.port.out.ProviderHealthSettings;
import com.narrativex.backend.feature.health.application.query.ProviderHealthQuery;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GetProviderHealthUseCaseTest {
  @Mock private ProviderHealthSettings settings;
  @InjectMocks private GetProviderHealthUseCase useCase;

  @Test
  void reportsVertexGeminiConfiguration() {
    when(settings.vertexGeminiEnabled()).thenReturn(true);
    when(settings.vertexGeminiLocation()).thenReturn("us-central1");
    when(settings.vertexGeminiModel()).thenReturn("gemini-3.8-flash");

    var response = useCase.execute(new ProviderHealthQuery());
    var health = response.data().vertexGemini();

    assertEquals("CONFIGURED", health.status());
    assertEquals("us-central1", health.location());
    assertEquals("gemini-3.8-flash", health.model());
    assertTrue(health.configured());
  }
}
