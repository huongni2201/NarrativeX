package com.narrativex.backend.modules.health.api.controller;

import com.narrativex.backend.modules.common.response.ApiResponse;
import com.narrativex.backend.modules.health.api.response.ProviderHealthResponse;
import com.narrativex.backend.modules.health.application.query.ProviderHealthQuery;
import com.narrativex.backend.modules.health.application.usecase.GetProviderHealthUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/provider-health")
public class ProviderHealthController {
    private final GetProviderHealthUseCase getProviderHealthUseCase;

    public ProviderHealthController(GetProviderHealthUseCase getProviderHealthUseCase) {
        this.getProviderHealthUseCase = getProviderHealthUseCase;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<ProviderHealthResponse>> get() {
        return ResponseEntity.ok(getProviderHealthUseCase.execute(new ProviderHealthQuery()));
    }
}
