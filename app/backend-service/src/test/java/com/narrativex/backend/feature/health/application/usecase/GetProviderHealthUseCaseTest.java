package com.narrativex.backend.feature.health.application.usecase;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
  void reportsLocalQwenConfigurationWithoutClaimingLiveInferenceVerification() {
    when(settings.qwenEnabled()).thenReturn(true);
    when(settings.runtime()).thenReturn("vllm-local");
    when(settings.model()).thenReturn("Qwen/Qwen3-8B-AWQ");

    var response = useCase.execute(new ProviderHealthQuery());
    var health = response.data().qwenLocal();

    assertEquals("CONFIGURED_NOT_VERIFIED", health.status());
    assertEquals("vllm-local", health.runtime());
    assertEquals("Qwen/Qwen3-8B-AWQ", health.model());
    assertFalse(health.externalCallVerified());
  }
}
