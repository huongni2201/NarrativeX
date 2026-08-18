package com.narrativex.backend.feature.auth.application.port.out;

public interface PasswordHashing {
  String encode(String rawPassword);
}
