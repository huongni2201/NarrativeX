package com.narrativex.backend.feature.auth.application.port.in;

/** Inbound authentication policy boundary used by HTTP adapters. */
public interface AuthRateLimitPolicy {
  void checkLogin(String email, String clientIp);

  void checkRegister(String email, String clientIp);
}
