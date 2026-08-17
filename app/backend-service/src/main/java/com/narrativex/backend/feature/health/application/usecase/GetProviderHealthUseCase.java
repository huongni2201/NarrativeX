package com.narrativex.backend.feature.health.application.usecase;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.health.api.response.ProviderHealthResponse;
import com.narrativex.backend.feature.health.application.port.out.ProviderHealthSettings;
import com.narrativex.backend.feature.health.application.query.ProviderHealthQuery;
import org.springframework.stereotype.Service;

@Service
public class GetProviderHealthUseCase {
    private final ProviderHealthSettings settings;

    public GetProviderHealthUseCase(ProviderHealthSettings settings) {
        this.settings = settings;
    }

    public ApiResponse<ProviderHealthResponse> execute(ProviderHealthQuery query) {
        ProviderHealthResponse response = new ProviderHealthResponse(new ProviderHealthResponse.VertexGeminiHealth(
            settings.vertexGeminiEnabled() ? "CONFIGURED_NOT_VERIFIED" : "NOT_CONFIGURED",
            settings.location(), settings.model(), false));
        return ApiResponse.success("Provider health retrieved successfully", response);
    }
}
