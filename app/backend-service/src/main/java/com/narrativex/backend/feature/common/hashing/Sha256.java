package com.narrativex.backend.feature.common.hashing;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** Digest primitive only; normalization and fingerprint composition belong to callers. */
public final class Sha256 {
  private Sha256() {}

  public static String hexUtf8(String value) {
    return hex(value.getBytes(StandardCharsets.UTF_8));
  }

  public static String hex(byte[] value) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 must be available in the JDK", exception);
    }
  }
}
