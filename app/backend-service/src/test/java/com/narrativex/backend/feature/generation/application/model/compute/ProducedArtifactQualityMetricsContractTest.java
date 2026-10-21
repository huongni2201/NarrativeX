package com.narrativex.backend.feature.generation.application.model.compute;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/** Reads the shared compute contract example, so the worker and backend cannot drift apart. */
class ProducedArtifactQualityMetricsContractTest {
  private static final Path EXAMPLE =
      Path.of("../../contracts/compute/v1/examples/succeeded-video-observation.json");
  private static final JsonMapper STRICT =
      JsonMapper.builder().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build();

  private static ObjectNode producedVideo() throws IOException {
    return (ObjectNode) STRICT.readTree(Files.readString(EXAMPLE)).at("/outputs/0");
  }

  private static ObjectNode technicalMetadata(ObjectNode produced) {
    return (ObjectNode) produced.get("technicalMetadata");
  }

  private static ProducedArtifactDto read(JsonNode produced) throws IOException {
    return STRICT.treeToValue(produced, ProducedArtifactDto.class);
  }

  @Test
  void sharedExampleCarriesEveryQualityMeasurement() throws IOException {
    VideoQualityMetricsDto quality = read(producedVideo()).technicalMetadata().qualityMetrics();

    assertThat(quality.status()).isEqualTo("MEASURED");
    assertThat(quality.measured()).isTrue();
    assertThat(quality.scorerVersion()).isEqualTo("FFMPEG_TAKE_QC_V2");
    assertThat(quality.freezeHeadMs()).isEqualTo(417L);
    assertThat(quality.freezeTailMs()).isZero();
    assertThat(quality.whiteTotalMs()).isZero();
    assertThat(quality.stddevY()).isEqualTo(6.4);
    assertThat(quality.stddevU()).isEqualTo(1.2);
    assertThat(quality.stddevV()).isEqualTo(1.5);
    assertThat(quality.lowY()).isEqualTo(44.0);
    assertThat(quality.highY()).isEqualTo(201.5);
    assertThat(quality.freezeTotalMs()).isEqualTo(583L);
    assertThat(quality.motionMean()).isEqualTo(2.84);
    assertThat(quality.sceneCutCount()).isZero();
    assertThat(quality.flickerStddev()).isEqualTo(0.62);
    assertThat(quality.blackTotalMs()).isZero();
    assertThat(quality.silenceTotalMs()).isEqualTo(1200L);
    assertThat(quality.integratedLufs()).isEqualTo(-19.4);
    assertThat(quality.peakDbfs()).isEqualTo(-3.1);
    assertThat(quality.meanY()).isEqualTo(118.2);
    assertThat(quality.meanU()).isEqualTo(126.7);
    assertThat(quality.meanV()).isEqualTo(129.1);
  }

  @Test
  void qualityMetricsSerializeWithTheWireNames() throws IOException {
    ObjectNode original = producedVideo();

    // Re-read from text: valueToTree yields LongNode where the example has IntNode.
    JsonNode written = STRICT.readTree(STRICT.writeValueAsString(read(original)));

    assertThat(written.at("/technicalMetadata/qualityMetrics"))
        .isEqualTo(original.at("/technicalMetadata/qualityMetrics"));
  }

  @Test
  void technicalMetadataWithoutQualityMetricsStillDeserializes() throws IOException {
    ObjectNode produced = producedVideo();
    technicalMetadata(produced).remove("qualityMetrics");

    assertThat(read(produced).technicalMetadata().qualityMetrics()).isNull();
  }

  @Test
  void unavailableMeasurementKeepsItsReason() throws IOException {
    ObjectNode produced = producedVideo();
    ObjectNode quality = (ObjectNode) technicalMetadata(produced).get("qualityMetrics");
    quality.removeAll();
    quality.put("status", "UNAVAILABLE");
    quality.put("scorerVersion", "FFMPEG_TAKE_QC_V2");
    quality.put("reason", "FFmpeg quality scoring timed out");

    VideoQualityMetricsDto read = read(produced).technicalMetadata().qualityMetrics();

    assertThat(read.measured()).isFalse();
    assertThat(read.reason()).isEqualTo("FFmpeg quality scoring timed out");
    assertThat(read.freezeTotalMs()).isNull();
  }

  @Test
  void unknownQualityFieldIsRejected() throws IOException {
    ObjectNode produced = producedVideo();
    ((ObjectNode) technicalMetadata(produced).get("qualityMetrics")).put("verdict", "GOOD");

    assertThatThrownBy(() -> read(produced)).hasMessageContaining("verdict");
  }
}
