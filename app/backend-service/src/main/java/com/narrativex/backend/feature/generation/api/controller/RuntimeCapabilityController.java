package com.narrativex.backend.feature.generation.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.generation.api.response.RuntimeCapabilityView;
import com.narrativex.backend.feature.generation.application.query.RuntimeCapabilityQuery;
import com.narrativex.backend.feature.generation.application.service.RuntimeCapabilityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/runtime/capabilities")
public class RuntimeCapabilityController {
  private final RuntimeCapabilityService runtimeCapabilityService;

  @GetMapping
  public ResponseEntity<ApiResponse<RuntimeCapabilityView>> getCapabilities() {
    var view = runtimeCapabilityService.query(new RuntimeCapabilityQuery());
    return ResponseEntity.ok(ApiResponse.success("Runtime capabilities retrieved successfully", view));
  }
}
