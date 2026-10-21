package com.narrativex.backend.feature.generation.application.service;

/**
 * Facts read from the header of a PCM WAV file. ADR-0007 requires narration to be 48 kHz mono
 * signed 16-bit PCM, and the header is the only duration source that does not trust the worker.
 */
public record WavPcmFormat(int channels, int sampleRateHz, int bitsPerSample, long durationMs) {
  public static final String CODEC = "PCM_S16LE";

  /** Parses the RIFF chunks and rejects anything but uncompressed PCM with a bounded data chunk. */
  public static WavPcmFormat parse(byte[] wav) {
    if (wav == null || wav.length < 12 || !tag(wav, 0, "RIFF") || !tag(wav, 8, "WAVE")) {
      throw new IllegalArgumentException("Narration audio is not a RIFF/WAVE file");
    }
    int channels = 0;
    int sampleRate = 0;
    int bits = 0;
    boolean formatSeen = false;
    int offset = 12;
    while (offset + 8 <= wav.length) {
      long chunkSize = uint32(wav, offset + 4);
      int body = offset + 8;
      if (tag(wav, offset, "fmt ")) {
        if (chunkSize < 16 || body + 16 > wav.length) {
          throw new IllegalArgumentException("Narration WAV fmt chunk is truncated");
        }
        int audioFormat = uint16(wav, body);
        if (audioFormat != 1) {
          throw new IllegalArgumentException("Narration WAV must be uncompressed PCM");
        }
        channels = uint16(wav, body + 2);
        sampleRate = (int) uint32(wav, body + 4);
        bits = uint16(wav, body + 14);
        formatSeen = true;
      } else if (tag(wav, offset, "data")) {
        if (!formatSeen) {
          throw new IllegalArgumentException("Narration WAV data chunk precedes its fmt chunk");
        }
        long available = wav.length - (long) body;
        // A streamed WAV may declare an oversized or zero data length; trust only what is present.
        long dataBytes = chunkSize == 0 || chunkSize > available ? available : chunkSize;
        long bytesPerSecond = (long) sampleRate * channels * (bits / 8);
        if (bytesPerSecond <= 0 || dataBytes <= 0) {
          throw new IllegalArgumentException("Narration WAV has no audio samples");
        }
        return new WavPcmFormat(channels, sampleRate, bits, dataBytes * 1000L / bytesPerSecond);
      }
      long next = body + chunkSize + (chunkSize & 1L);
      if (next > wav.length) break;
      offset = (int) next;
    }
    throw new IllegalArgumentException("Narration WAV has no data chunk");
  }

  /** The normalized narration master: 48 kHz, mono, signed 16-bit PCM. */
  public boolean isNarrationMaster() {
    return channels == 1 && sampleRateHz == 48_000 && bitsPerSample == 16 && durationMs > 0;
  }

  private static boolean tag(byte[] bytes, int offset, String tag) {
    if (offset + 4 > bytes.length) return false;
    for (int index = 0; index < 4; index++) {
      if (bytes[offset + index] != (byte) tag.charAt(index)) return false;
    }
    return true;
  }

  private static int uint16(byte[] bytes, int offset) {
    return (bytes[offset] & 0xFF) | ((bytes[offset + 1] & 0xFF) << 8);
  }

  private static long uint32(byte[] bytes, int offset) {
    return (bytes[offset] & 0xFFL)
        | ((bytes[offset + 1] & 0xFFL) << 8)
        | ((bytes[offset + 2] & 0xFFL) << 16)
        | ((bytes[offset + 3] & 0xFFL) << 24);
  }
}
