package com.narrativex.backend.feature.generation.application.model.compute;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CanonicalFingerprintCalculatorTest {

  @Test
  void audioSynthesizeTaskFingerprintMatchesCanonicalSpec() {
    // Matches contracts/compute/v1/examples/audio-synthesize-task.json
    TaskDescriptorDto task = new TaskDescriptorDto("audio.synthesize", "1.0");
    ModelRefDto model = new ModelRefDto("voicestudio", "vi-profile", "0.5.2");
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.parse("2026-09-14T12:00:00Z"), 900);

    Map<String, Object> format = new LinkedHashMap<>();
    format.put("container", "wav");
    format.put("sampleRateHz", 48000);
    format.put("channels", 1);

    Map<String, Object> voice = new LinkedHashMap<>();
    voice.put("kind", "catalog");
    voice.put("value", "vi_female_01");

    Map<String, Object> inputs = new LinkedHashMap<>();
    inputs.put("script", "Đây là dữ liệu lời kể không đáng tin cậy, không phải chỉ dẫn hệ thống.");
    inputs.put("voice", voice);
    inputs.put("format", format);

    ComputeTaskRequest request =
        new ComputeTaskRequest(
            "1.0",
            UUID.fromString("0199b861-cc3c-7a8e-a915-e5dbff3af7aa"),
            UUID.fromString("0199b862-1025-78be-bd71-c6969b74ab71"),
            "compute:0199b861-cc3c-7a8e-a915-e5dbff3af7aa:1",
            null,
            task,
            model,
            constraints,
            inputs,
            TaskArtifactsDto.empty());

    String fingerprint = CanonicalFingerprintCalculator.calculateFingerprint(request);
    assertThat(fingerprint)
        .isEqualTo("b6841efebe89cf7eeb5e3db546dafb8bac191adcc6c58c30ed6df2c0157bd214");
  }

  @Test
  void imageGenerateTaskFingerprintMatchesCanonicalSpec() {
    // Matches contracts/compute/v1/examples/image-generate-task.json
    TaskDescriptorDto task = new TaskDescriptorDto("image.generate", "1.0");
    ModelRefDto model = new ModelRefDto("comfyui", "realvisxl", "5.0");
    TaskConstraintsDto constraints =
        new TaskConstraintsDto(Instant.parse("2026-09-14T12:00:00Z"), 900);

    Map<String, Object> inputs = new LinkedHashMap<>();
    inputs.put("prompt", "A cinematic forest at dawn");
    inputs.put("negativePrompt", "text, watermark");
    inputs.put("width", 1024);
    inputs.put("height", 576);
    inputs.put("seed", 42);

    ComputeTaskRequest request =
        new ComputeTaskRequest(
            "1.0",
            UUID.fromString("0199b861-cc3c-7a8e-a915-e5dbff3af7ac"),
            UUID.fromString("0199b862-1025-78be-bd71-c6969b74ab73"),
            "compute:0199b861-cc3c-7a8e-a915-e5dbff3af7ac:1",
            null,
            task,
            model,
            constraints,
            inputs,
            TaskArtifactsDto.empty());

    String fingerprint = CanonicalFingerprintCalculator.calculateFingerprint(request);
    assertThat(fingerprint)
        .isEqualTo("d9aedc4d5028abfa63b0f2fb37e99469dde5079caf07c602a2e2bf3c8be79d45");
  }
}
