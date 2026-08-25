package com.narrativex.backend.feature.auth.api.controller;

import com.narrativex.backend.feature.auth.api.request.DesktopAuthExchangeRequest;
import com.narrativex.backend.feature.auth.api.request.DesktopGuestSessionRequest;
import com.narrativex.backend.feature.auth.api.response.CurrentUserResponse;
import com.narrativex.backend.feature.auth.application.port.in.DesktopAuthHandoff;
import com.narrativex.backend.feature.auth.application.port.in.DesktopGuestIdentity;
import com.narrativex.backend.feature.common.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/auth/desktop")
public class DesktopAuthController {
  private static final String REDIRECT_SESSION_KEY = "NARRATIVEX_DESKTOP_REDIRECT_URI";
  private static final String CODE_CHALLENGE_SESSION_KEY = "NARRATIVEX_DESKTOP_CODE_CHALLENGE";
  private static final String CODE_CHALLENGE_PATTERN = "[A-Za-z0-9_-]{43}";
  private static final String ROLE_USER = "ROLE_USER";
  private static final String ROLE_GUEST = "ROLE_GUEST";

  private final DesktopAuthHandoff handoffStore;
  private final DesktopGuestIdentity desktopGuestIdentity;
  private final SecurityContextRepository securityContextRepository;

  @GetMapping("/start")
  public void start(
      @RequestParam(name = "redirect_uri", defaultValue = "narrativex://auth/callback")
          String redirectUri,
      @RequestParam(name = "code_challenge", required = false) String codeChallenge,
      HttpServletRequest request,
      HttpServletResponse response)
      throws IOException {
    if (!isAllowedRedirect(redirectUri) || !isAllowedCodeChallenge(codeChallenge)) {
      response.sendError(HttpStatus.BAD_REQUEST.value(), "Unsupported desktop redirect URI.");
      return;
    }
    var session = request.getSession(true);
    session.setAttribute(REDIRECT_SESSION_KEY, redirectUri);
    session.setAttribute(CODE_CHALLENGE_SESSION_KEY, codeChallenge);
    response.sendRedirect("/oauth2/authorization/google");
  }

  @PostMapping("/guest")
  public ResponseEntity<ApiResponse<CurrentUserResponse>> guest(
      @Valid @RequestBody DesktopGuestSessionRequest request,
      HttpServletRequest servletRequest,
      HttpServletResponse servletResponse) {
    Authentication existing = SecurityContextHolder.getContext().getAuthentication();
    if (hasAuthority(existing, ROLE_USER)) {
      return ResponseEntity.status(HttpStatus.CONFLICT)
          .body(
              new ApiResponse<>(
                  false, "Desktop session is already signed in.", null, Instant.now()));
    }

    final String stableGuestUserId;
    try {
      stableGuestUserId = desktopGuestIdentity.establish(request.deviceId(), request.secret());
    } catch (BadCredentialsException exception) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(
              new ApiResponse<>(
                  false, "Desktop guest credentials are invalid.", null, Instant.now()));
    }

    if (hasAuthority(existing, ROLE_GUEST) && !stableGuestUserId.equals(existing.getName())) {
      desktopGuestIdentity.transferOwnership(existing.getName(), stableGuestUserId);
    }

    Authentication authentication =
        UsernamePasswordAuthenticationToken.authenticated(
            stableGuestUserId, null, List.of(new SimpleGrantedAuthority(ROLE_GUEST)));
    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    securityContextRepository.saveContext(context, servletRequest, servletResponse);

    return ResponseEntity.ok(
        ApiResponse.success(
            "Guest desktop session established",
            new CurrentUserResponse(stableGuestUserId, "Khách", null, null, true)));
  }

  @PostMapping("/exchange")
  public ResponseEntity<ApiResponse<CurrentUserResponse>> exchange(
      @Valid @RequestBody DesktopAuthExchangeRequest request,
      HttpServletRequest servletRequest,
      HttpServletResponse servletResponse) {
    DesktopAuthHandoff.AuthenticatedUser user =
        handoffStore.consumeUser(request.code(), request.codeVerifier());
    if (user == null) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
          .body(
              new ApiResponse<>(
                  false, "Desktop auth code is invalid or expired.", null, Instant.now()));
    }

    Authentication existing = SecurityContextHolder.getContext().getAuthentication();
    if (hasAuthority(existing, ROLE_GUEST)) {
      desktopGuestIdentity.transferOwnership(existing.getName(), user.id());
    }

    rotateExistingSession(servletRequest);

    Authentication authentication =
        UsernamePasswordAuthenticationToken.authenticated(
            user, null, List.of(new SimpleGrantedAuthority(ROLE_USER)));
    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    securityContextRepository.saveContext(context, servletRequest, servletResponse);

    return ResponseEntity.ok(
        ApiResponse.success(
            "Desktop session established",
            new CurrentUserResponse(
                user.id(), user.displayName(), user.email(), user.avatarUrl(), false)));
  }

  private static void rotateExistingSession(HttpServletRequest request) {
    if (request.getSession(false) != null) {
      request.changeSessionId();
    }
  }

  private static boolean hasAuthority(Authentication authentication, String authority) {
    return authentication != null
        && authentication.isAuthenticated()
        && authentication.getAuthorities().stream()
            .anyMatch(grantedAuthority -> authority.equals(grantedAuthority.getAuthority()));
  }

  static boolean isAllowedRedirect(String redirectUri) {
    try {
      URI uri = new URI(redirectUri);
      return "narrativex".equalsIgnoreCase(uri.getScheme())
          && "auth".equalsIgnoreCase(uri.getHost())
          && "/callback".equals(uri.getPath())
          && uri.getUserInfo() == null
          && uri.getPort() == -1
          && uri.getQuery() == null
          && uri.getFragment() == null;
    } catch (URISyntaxException exception) {
      return false;
    }
  }

  static boolean isAllowedCodeChallenge(String codeChallenge) {
    return codeChallenge != null && codeChallenge.matches(CODE_CHALLENGE_PATTERN);
  }
}
