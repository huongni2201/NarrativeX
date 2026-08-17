package com.narrativex.backend.modules.auth.application.usecase;

import com.narrativex.backend.modules.auth.api.response.CurrentUserResponse;
import com.narrativex.backend.modules.auth.application.port.in.CurrentUserProfile;
import com.narrativex.backend.modules.auth.application.query.CurrentUserQuery;
import com.narrativex.backend.modules.common.response.ApiResponse;
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
