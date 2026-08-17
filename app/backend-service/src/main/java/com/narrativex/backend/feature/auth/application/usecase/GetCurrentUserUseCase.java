package com.narrativex.backend.feature.auth.application.usecase;

import com.narrativex.backend.feature.auth.api.response.CurrentUserResponse;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserProfile;
import com.narrativex.backend.feature.auth.application.query.CurrentUserQuery;
import com.narrativex.backend.feature.common.response.ApiResponse;
import org.springframework.stereotype.Service;

@Service
public class GetCurrentUserUseCase {
    private final CurrentUserProfile currentUserProfile;

    public GetCurrentUserUseCase(CurrentUserProfile currentUserProfile) {
        this.currentUserProfile = currentUserProfile;
    }

    public ApiResponse<CurrentUserResponse> execute(CurrentUserQuery query) {
        return ApiResponse.success("Current user retrieved successfully", currentUserProfile.current());
    }
}
