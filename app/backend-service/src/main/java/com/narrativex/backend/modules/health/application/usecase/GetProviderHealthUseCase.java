package com.narrativex.backend.modules.health.application.usecase;

import com.narrativex.backend.modules.health.application.port.out.ProviderHealthSettings;
import com.narrativex.backend.modules.health.application.query.ProviderHealthQuery;
import com.narrativex.backend.modules.health.application.response.ProviderHealthResponse;
import com.narrativex.backend.shared.application.response.ApiResponse;
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
