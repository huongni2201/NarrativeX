package com.narrativex.backend.feature.generation.infrastructure.compute.node;

import static org.assertj.core.api.Assertions.assertThat;

import com.narrativex.backend.feature.generation.infrastructure.compute.ComputeServiceProperties;
import java.time.Instant;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ComputeTargetRegistryTest {

  @Test
  void registersDefaultTargetFromProperties() {
    ComputeServiceProperties props = new ComputeServiceProperties();
    props.setBaseUrl("http://remote-gpu:8010");
    props.setMachineToken("secret-token");

    ComputeTargetRegistry registry = new ComputeTargetRegistry(props);

    assertThat(registry.getAll()).containsKey(ComputeTargetRegistry.DEFAULT_TARGET_ID);
    ComputeTarget target = registry.findById(ComputeTargetRegistry.DEFAULT_TARGET_ID).orElseThrow();
    assertThat(target.baseUrl()).isEqualTo("http://remote-gpu:8010");
    assertThat(target.machineToken()).isEqualTo("secret-token");
    assertThat(target.isReady()).isTrue();
  }

  @Test
  void resolvesTargetForSpecificExecutor() {
    ComputeServiceProperties props = new ComputeServiceProperties();
    props.setBaseUrl("http://default-worker:8010");
    ComputeTargetRegistry registry = new ComputeTargetRegistry(props);

    ComputeTarget specialized =
        new ComputeTarget(
            "vieneu-worker",
            "VieNeu Dedicated Node",
            "http://vieneu-node:8008",
            "token-v",
            ComputeTargetStatus.ONLINE,
            Set.of("vieneu"),
            Instant.now());
    registry.register(specialized);

    var resolvedVieNeu = registry.resolveTargetForExecutor("vieneu");
    assertThat(resolvedVieNeu).isPresent();
    // Should resolve a matching target for vieneu
    assertThat(resolvedVieNeu.get().supportedExecutors()).contains("vieneu");

    var resolvedComfy = registry.resolveTargetForExecutor("comfyui");
    assertThat(resolvedComfy).isPresent();
    assertThat(resolvedComfy.get().id()).isEqualTo(ComputeTargetRegistry.DEFAULT_TARGET_ID);
  }

  @Test
  void updatesStatusToDraining() {
    ComputeServiceProperties props = new ComputeServiceProperties();
    props.setBaseUrl("http://remote-gpu:8010");
    ComputeTargetRegistry registry = new ComputeTargetRegistry(props);

    registry.updateStatus(ComputeTargetRegistry.DEFAULT_TARGET_ID, ComputeTargetStatus.DRAINING);

    ComputeTarget target = registry.findById(ComputeTargetRegistry.DEFAULT_TARGET_ID).orElseThrow();
    assertThat(target.status()).isEqualTo(ComputeTargetStatus.DRAINING);
    assertThat(target.isReady()).isFalse();
  }
}
