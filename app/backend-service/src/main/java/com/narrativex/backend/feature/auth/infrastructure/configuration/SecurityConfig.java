package com.narrativex.backend.feature.auth.infrastructure.configuration;

import com.narrativex.backend.feature.auth.infrastructure.desktop.DesktopAuthenticationSuccessHandler;
import com.narrativex.backend.feature.auth.infrastructure.security.ApiAccessDeniedHandler;
import com.narrativex.backend.feature.auth.infrastructure.security.ApiAuthenticationEntryPoint;
import com.narrativex.backend.feature.auth.infrastructure.security.NarrativeXOidcUserService;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.DelegatingSecurityContextRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
  private static final String[] PUBLIC_AUTH_PATHS = {
    "/actuator/health",
    "/api/v1/auth/csrf",
    "/api/v1/auth/desktop/start",
    "/api/v1/auth/desktop/exchange",
    "/api/v1/auth/desktop/guest",
    "/api/v1/local-devices/pair",
    "/api/v1/local-devices/heartbeat",
    "/api/v1/local-devices/project-renders/**"
  };

  private static final String[] GUEST_WORKSPACE_POST_PATHS = {
    "/api/v1/projects",
    "/api/v1/projects/*/stories",
    "/api/v1/projects/*/chapters",
    "/api/v1/projects/*/chapters/batch-import",
    "/api/v1/projects/*/chapters/*/content",
    "/api/v1/characters",
    "/api/v1/assets/local"
  };

  private static final String[] GUEST_WORKSPACE_PUT_PATHS = {
    "/api/v1/projects/*/chapters/*",
    "/api/v1/characters/*/versions/*/references"
  };

  private static final String[] GUEST_WORKSPACE_DELETE_PATHS = {
    "/api/v1/projects/*/chapters/*", "/api/v1/assets/*"
  };

  private static final String API_PATH = "/api/v1/**";

  private static final String[] DEVICE_CSRF_IGNORED_PATHS = {
    "/api/v1/auth/desktop/exchange",
    "/api/v1/local-devices/pair",
    "/api/v1/local-devices/heartbeat",
    "/api/v1/local-devices/project-renders/**"
  };

  @Bean
  SecurityContextRepository securityContextRepository() {
    return new DelegatingSecurityContextRepository(
        new RequestAttributeSecurityContextRepository(),
        new HttpSessionSecurityContextRepository());
  }

  @Bean("narrativeXOidcDelegate")
  OidcUserService narrativeXOidcDelegate() {
    return new OidcUserService();
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource(
      @Value(
              "${narrativex.security.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173,null}")
          String origins) {
    List<String> allowedOrigins =
        Arrays.stream(origins.split(","))
            .map(String::trim)
            .filter(value -> !value.isEmpty())
            .toList();
    CorsConfiguration configuration = new CorsConfiguration();
    configuration.setAllowedOrigins(allowedOrigins);
    configuration.setAllowedMethods(
        List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"));
    configuration.setAllowedHeaders(
        List.of(
            "Accept",
            "Content-Type",
            "X-CSRF-TOKEN",
            "X-XSRF-TOKEN",
            "X-Correlation-Id",
            "If-Match",
            "Idempotency-Key",
            "X-NX-Device-Token"));
    configuration.setExposedHeaders(List.of("ETag", "Location", "X-Correlation-Id"));
    configuration.setAllowCredentials(true);
    configuration.setMaxAge(3600L);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
  }

  @Bean
  @Order(1)
  @ConditionalOnProperty(
      prefix = "narrativex.security",
      name = "oidc-enabled",
      havingValue = "true")
  SecurityFilterChain oidcSecurityFilterChain(
      HttpSecurity http,
      ApiAuthenticationEntryPoint authenticationEntryPoint,
      ApiAccessDeniedHandler accessDeniedHandler,
      NarrativeXOidcUserService oidcUserService,
      DesktopAuthenticationSuccessHandler desktopAuthenticationSuccessHandler,
      SecurityContextRepository securityContextRepository)
      throws Exception {
    http.cors(Customizer.withDefaults())
        .csrf(
            csrf ->
                csrf.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                    .ignoringRequestMatchers(DEVICE_CSRF_IGNORED_PATHS))
        .securityContext(context -> context.securityContextRepository(securityContextRepository))
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers(PUBLIC_AUTH_PATHS)
                    .permitAll()
                    .requestMatchers("/oauth2/**", "/login/**")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, GUEST_WORKSPACE_POST_PATHS)
                    .hasAnyRole("USER", "GUEST")
                    .requestMatchers(HttpMethod.PUT, GUEST_WORKSPACE_PUT_PATHS)
                    .hasAnyRole("USER", "GUEST")
                    .requestMatchers(HttpMethod.DELETE, GUEST_WORKSPACE_DELETE_PATHS)
                    .hasAnyRole("USER", "GUEST")
                    .requestMatchers(HttpMethod.POST, API_PATH)
                    .hasRole("USER")
                    .requestMatchers(HttpMethod.PUT, API_PATH)
                    .hasRole("USER")
                    .requestMatchers(HttpMethod.PATCH, API_PATH)
                    .hasRole("USER")
                    .requestMatchers(HttpMethod.DELETE, API_PATH)
                    .hasRole("USER")
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(
            errors ->
                errors
                    .authenticationEntryPoint(authenticationEntryPoint)
                    .accessDeniedHandler(accessDeniedHandler))
        .oauth2Login(
            oauth2 ->
                oauth2
                    .userInfoEndpoint(userInfo -> userInfo.oidcUserService(oidcUserService))
                    .successHandler(desktopAuthenticationSuccessHandler))
        .logout(
            logout ->
                logout
                    .logoutUrl("/logout")
                    .invalidateHttpSession(true)
                    .clearAuthentication(true)
                    .deleteCookies("NX_SESSION", "XSRF-TOKEN")
                    .logoutSuccessHandler(
                        (request, response, authentication) ->
                            response.setStatus(HttpServletResponse.SC_NO_CONTENT)));
    return http.build();
  }

  @Bean
  @Order(2)
  @Profile({"local", "test"})
  @ConditionalOnProperty(
      prefix = "narrativex.security",
      name = "oidc-enabled",
      havingValue = "false",
      matchIfMissing = true)
  SecurityFilterChain localSecurityFilterChain(
      HttpSecurity http,
      ApiAuthenticationEntryPoint authenticationEntryPoint,
      ApiAccessDeniedHandler accessDeniedHandler,
      SecurityContextRepository securityContextRepository,
      @Value("${narrativex.security.local-user-id:local-dev-user}") String localUserId,
      @Value("${narrativex.security.local-dev-identity-enabled:false}")
          boolean localDevIdentityEnabled)
      throws Exception {
    http.cors(Customizer.withDefaults())
        .csrf(
            csrf ->
                csrf.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                    .ignoringRequestMatchers(DEVICE_CSRF_IGNORED_PATHS))
        .securityContext(context -> context.securityContextRepository(securityContextRepository))
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
        .logout(
            logout ->
                logout
                    .logoutUrl("/logout")
                    .invalidateHttpSession(true)
                    .clearAuthentication(true)
                    .deleteCookies("NX_SESSION", "XSRF-TOKEN")
                    .logoutSuccessHandler(
                        (request, response, authentication) ->
                            response.setStatus(HttpServletResponse.SC_NO_CONTENT)))
        .exceptionHandling(
            errors ->
                errors
                    .authenticationEntryPoint(authenticationEntryPoint)
                    .accessDeniedHandler(accessDeniedHandler));

    if (localDevIdentityEnabled) {
      http.anonymous(
              anonymous ->
                  anonymous.key("narrativex-local").principal(localUserId).authorities("ROLE_USER"))
          .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
    } else {
      http.authorizeHttpRequests(
          auth ->
              auth.requestMatchers(PUBLIC_AUTH_PATHS)
                  .permitAll()
                  .requestMatchers(HttpMethod.POST, GUEST_WORKSPACE_POST_PATHS)
                  .hasAnyRole("USER", "GUEST")
                  .requestMatchers(HttpMethod.PUT, GUEST_WORKSPACE_PUT_PATHS)
                  .hasAnyRole("USER", "GUEST")
                  .requestMatchers(HttpMethod.DELETE, GUEST_WORKSPACE_DELETE_PATHS)
                  .hasAnyRole("USER", "GUEST")
                  .requestMatchers(HttpMethod.POST, API_PATH)
                  .hasRole("USER")
                  .requestMatchers(HttpMethod.PUT, API_PATH)
                  .hasRole("USER")
                  .requestMatchers(HttpMethod.PATCH, API_PATH)
                  .hasRole("USER")
                  .requestMatchers(HttpMethod.DELETE, API_PATH)
                  .hasRole("USER")
                  .anyRequest()
                  .authenticated());
    }
    return http.build();
  }
}
