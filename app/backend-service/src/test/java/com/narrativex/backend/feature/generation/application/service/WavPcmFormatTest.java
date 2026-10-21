package com.narrativex.backend.feature.generation.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class WavPcmFormatTest {
  @Test
  void readsDurationAndFormatFromTheHeader() {
    WavPcmFormat format = WavPcmFormat.parse(wav(1, 48_000, 16, 1, 96_000, false));

    assertThat(format.channels()).isEqualTo(1);
    assertThat(format.sampleRateHz()).isEqualTo(48_000);
    assertThat(format.bitsPerSample()).isEqualTo(16);
    assertThat(format.durationMs()).isEqualTo(2_000L);
    assertThat(format.isNarrationMaster()).isTrue();
  }

  @Test
  void skipsExtraChunksBeforeTheDataChunk() {
    WavPcmFormat format = WavPcmFormat.parse(wav(1, 48_000, 16, 1, 48_000, true));

    assertThat(format.durationMs()).isEqualTo(1_000L);
  }

  @Test
  void trustsTheBytesPresentWhenTheDeclaredDataLengthIsOversized() {
    byte[] bytes = wav(1, 48_000, 16, 1, 48_000, false);
    ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).putInt(40, Integer.MAX_VALUE);

    assertThat(WavPcmFormat.parse(bytes).durationMs()).isEqualTo(1_000L);
  }

  @Test
  void otherFormatsAreNotTheNarrationMaster() {
    assertThat(WavPcmFormat.parse(wav(1, 44_100, 16, 1, 44_100, false)).isNarrationMaster())
        .isFalse();
    assertThat(WavPcmFormat.parse(wav(1, 48_000, 16, 2, 48_000, false)).isNarrationMaster())
        .isFalse();
  }

  @Test
  void rejectsCompressedAndMalformedAudio() {
    assertThatThrownBy(() -> WavPcmFormat.parse(wav(3, 48_000, 16, 1, 480, false)))
        .hasMessageContaining("uncompressed PCM");
    assertThatThrownBy(() -> WavPcmFormat.parse("not audio".getBytes(StandardCharsets.US_ASCII)))
        .hasMessageContaining("RIFF");
    assertThatThrownBy(() -> WavPcmFormat.parse(null)).isInstanceOf(IllegalArgumentException.class);
  }

  private static byte[] wav(
      int audioFormat, int sampleRate, int bits, int channels, int frames, boolean listChunk) {
    int dataBytes = frames * channels * (bits / 8);
    int extra = listChunk ? 8 + 5 + 1 : 0; // odd-sized chunk is padded to an even length
    ByteBuffer buffer = ByteBuffer.allocate(44 + extra + dataBytes).order(ByteOrder.LITTLE_ENDIAN);
    buffer.put(ascii("RIFF")).putInt(36 + extra + dataBytes).put(ascii("WAVE"));
    buffer.put(ascii("fmt ")).putInt(16);
    buffer.putShort((short) audioFormat).putShort((short) channels).putInt(sampleRate);
    buffer
        .putInt(sampleRate * channels * (bits / 8))
        .putShort((short) (channels * (bits / 8)))
        .putShort((short) bits);
    if (listChunk) {
      buffer.put(ascii("LIST")).putInt(5).put(new byte[] {1, 2, 3, 4, 5, 0});
    }
    buffer.put(ascii("data")).putInt(dataBytes);
    return buffer.array();
  }

  private static byte[] ascii(String text) {
    return text.getBytes(StandardCharsets.US_ASCII);
  }
}
