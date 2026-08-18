package com.narrativex.backend.feature.auth.api.controller;

import com.narrativex.backend.feature.auth.api.request.LoginRequest;
import com.narrativex.backend.feature.auth.api.request.RegisterRequest;
import com.narrativex.backend.feature.auth.api.response.CurrentUserResponse;
import com.narrativex.backend.feature.auth.application.port.in.AuthRateLimitPolicy;
import com.narrativex.backend.feature.auth.application.query.CurrentUserQuery;
import com.narrativex.backend.feature.auth.application.service.RegisterAuthAccountService;
import com.narrativex.backend.feature.auth.application.usecase.GetCurrentUserUseCase;
import com.narrativex.backend.feature.common.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/auth")
public class PasswordAuthController {
  private final AuthenticationManager authenticationManager;
  private final SecurityContextRepository securityContextRepository;
  private final RegisterAuthAccountService registrationService;
  private final GetCurrentUserUseCase getCurrentUserUseCase;
  private final AuthRateLimitPolicy authRateLimitPolicy;

  @PostMapping("/login")
  public ResponseEntity<ApiResponse<CurrentUserResponse>> login(
      @Valid @RequestBody LoginRequest body,
      HttpServletRequest request,
      HttpServletResponse response) {
    authRateLimitPolicy.checkLogin(body.email(), request.getRemoteAddr());
    return authenticate(body.email(), body.password(), request, response);
  }

  @PostMapping("/register")
  public ResponseEntity<ApiResponse<CurrentUserResponse>> register(
      @Valid @RequestBody RegisterRequest body,
      HttpServletRequest request,
      HttpServletResponse response) {
    authRateLimitPolicy.checkRegister(body.email(), request.getRemoteAddr());
    registrationService.register(body.displayName(), body.email(), body.password());
    return authenticate(body.email(), body.password(), request, response);
  }

  private ResponseEntity<ApiResponse<CurrentUserResponse>> authenticate(
      String email,
      String password,
      HttpServletRequest request,
      HttpServletResponse response) {
    Authentication authentication =
        authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(email, password));

    HttpSession existingSession = request.getSession(false);
    if (existingSession != null) {
      existingSession.invalidate();
    }

    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    securityContextRepository.saveContext(context, request, response);
    return ResponseEntity.ok(getCurrentUserUseCase.execute(new CurrentUserQuery()));
  }
}
