package com.narrativex.backend.modules.auth.application.usecase;

import com.narrativex.backend.modules.auth.api.response.CsrfTokenResponse;
import com.narrativex.backend.modules.auth.application.query.CsrfTokenQuery;
import com.narrativex.backend.modules.common.response.ApiResponse;
import org.springframework.stereotype.Service;

@Service
public class GetCsrfTokenUseCase {
    public ApiResponse<CsrfTokenResponse> execute(CsrfTokenQuery query) {
        return ApiResponse.success("CSRF token retrieved successfully",
            new CsrfTokenResponse(query.token(), query.headerName()));
    }
}
