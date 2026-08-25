package com.narrativex.backend.feature.auth.api.controller;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class DesktopAuthControllerTest {
  @Test
  void acceptsCanonicalNarrativeXCallback() {
    assertTrue(DesktopAuthController.isAllowedRedirect("narrativex://auth/callback"));
  }

  @Test
  void rejectsLookalikeOrMutatedCallbacks() {
    assertFalse(DesktopAuthController.isAllowedRedirect("narrativex:/auth/callback"));
    assertFalse(DesktopAuthController.isAllowedRedirect("https://auth/callback"));
    assertFalse(DesktopAuthController.isAllowedRedirect("narrativex://evil/callback"));
    assertFalse(
        DesktopAuthController.isAllowedRedirect(
            "narrativex://auth/callback?next=https://evil.example"));
    assertFalse(DesktopAuthController.isAllowedRedirect("narrativex://auth/callback#fragment"));
  }
}
