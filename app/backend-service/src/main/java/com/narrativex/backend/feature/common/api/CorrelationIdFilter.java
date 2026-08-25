package com.narrativex.backend.feature.common.api;

import com.narrativex.backend.feature.common.uuid.UuidV7;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.regex.Pattern;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class CorrelationIdFilter extends OncePerRequestFilter {
  public static final String HEADER_NAME = "X-Correlation-Id";
  public static final String REQUEST_ATTRIBUTE = CorrelationIdFilter.class.getName() + ".id";
  private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    String correlationId = sanitize(request.getHeader(HEADER_NAME));
    request.setAttribute(REQUEST_ATTRIBUTE, correlationId);
    response.setHeader(HEADER_NAME, correlationId);
    MDC.put("correlationId", correlationId);
    try {
      filterChain.doFilter(request, response);
    } finally {
      MDC.remove("correlationId");
    }
  }

  public static String correlationId(HttpServletRequest request) {
    Object attribute = request.getAttribute(REQUEST_ATTRIBUTE);
    return attribute instanceof String value && !value.isBlank()
        ? value
        : UuidV7.random().toString();
  }

  private static String sanitize(String candidate) {
    return candidate != null && SAFE_ID.matcher(candidate).matches()
        ? candidate
        : UuidV7.random().toString();
  }
}
