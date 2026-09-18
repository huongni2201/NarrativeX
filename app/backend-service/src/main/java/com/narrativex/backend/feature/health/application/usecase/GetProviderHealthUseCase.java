package com.narrativex.backend.feature.health.application.usecase;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.health.api.response.ProviderHealthResponse;
import com.narrativex.backend.feature.health.application.port.out.ProviderHealthSettings;
import com.narrativex.backend.feature.health.application.query.ProviderHealthQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GetProviderHealthUseCase {
  private final ProviderHealthSettings settings;

  public ApiResponse<ProviderHealthResponse> execute(ProviderHealthQuery query) {
    ProviderHealthResponse response =
        new ProviderHealthResponse(
            new ProviderHealthResponse.VertexGeminiHealth(
                settings.vertexGeminiEnabled() ? "CONFIGURED" : "NOT_CONFIGURED",
                settings.vertexGeminiModel(),
                settings.vertexGeminiLocation(),
                settings.vertexGeminiEnabled()));
    return ApiResponse.success("Provider health retrieved successfully", response);
  }
}
