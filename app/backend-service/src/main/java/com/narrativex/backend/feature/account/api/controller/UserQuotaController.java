package com.narrativex.backend.feature.account.api.controller;

import com.narrativex.backend.feature.account.api.response.UserQuotaResponse;
import com.narrativex.backend.feature.account.application.usecase.GetUserQuotaUseCase;
import com.narrativex.backend.feature.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/users/me/quota")
public class UserQuotaController {
  private final GetUserQuotaUseCase getUserQuotaUseCase;

  @GetMapping
  public ResponseEntity<ApiResponse<UserQuotaResponse>> get() {
    return ResponseEntity.ok(
        ApiResponse.success(
            "User quota retrieved successfully", UserQuotaResponse.from(getUserQuotaUseCase.execute())));
  }
}
