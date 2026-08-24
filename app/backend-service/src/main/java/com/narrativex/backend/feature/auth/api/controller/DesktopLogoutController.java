package com.narrativex.backend.feature.auth.api.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class DesktopLogoutController {
  private final SecurityContextLogoutHandler logoutHandler = new SecurityContextLogoutHandler();

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
    logoutHandler.logout(request, response, SecurityContextHolder.getContext().getAuthentication());
    return ResponseEntity.noContent().build();
  }
}
