package com.narrativex.backend.feature.auth.application.usecase;

import com.narrativex.backend.feature.auth.api.response.CurrentUserResponse;
import com.narrativex.backend.feature.auth.application.port.in.CurrentUserProfile;
import com.narrativex.backend.feature.auth.application.query.CurrentUserQuery;
import com.narrativex.backend.feature.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GetCurrentUserUseCase {
  private final CurrentUserProfile currentUserProfile;

  public ApiResponse<CurrentUserResponse> execute(CurrentUserQuery query) {
    return ApiResponse.success("Current user retrieved successfully", currentUserProfile.current());
  }
}
