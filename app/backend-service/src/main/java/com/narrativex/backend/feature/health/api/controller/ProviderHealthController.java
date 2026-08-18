package com.narrativex.backend.feature.health.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.health.api.response.ProviderHealthResponse;
import com.narrativex.backend.feature.health.application.query.ProviderHealthQuery;
import com.narrativex.backend.feature.health.application.usecase.GetProviderHealthUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/provider-health")
public class ProviderHealthController {
  private final GetProviderHealthUseCase getProviderHealthUseCase;

  @GetMapping
  public ResponseEntity<ApiResponse<ProviderHealthResponse>> get() {
    return ResponseEntity.ok(getProviderHealthUseCase.execute(new ProviderHealthQuery()));
  }
}
