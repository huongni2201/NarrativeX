package com.narrativex.backend.feature.common.hashing;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class Sha256Test {
  @Test
  void hashesKnownUtf8VectorsWithoutNormalizingSource() {
    assertThat(Sha256.hexUtf8(""))
        .isEqualTo("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    assertThat(Sha256.hexUtf8("abc"))
        .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    assertThat(Sha256.hexUtf8("Tiếng Việt 🎬"))
        .isEqualTo("a586b9c6e031b2e097b5e75e3fcd1ee0adabdb46792dddd719329c0a598bf7c0")
        .isEqualTo(Sha256.hex("Tiếng Việt 🎬".getBytes(StandardCharsets.UTF_8)));
    assertThat(Sha256.hexUtf8("a\r\nb")).isNotEqualTo(Sha256.hexUtf8("a\nb"));
  }
}
