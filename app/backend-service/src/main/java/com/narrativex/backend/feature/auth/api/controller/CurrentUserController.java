package com.narrativex.backend.feature.auth.api.controller;

import com.narrativex.backend.feature.auth.api.response.CurrentUserResponse;
import com.narrativex.backend.feature.auth.application.query.CurrentUserQuery;
import com.narrativex.backend.feature.auth.application.usecase.GetCurrentUserUseCase;
import com.narrativex.backend.feature.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping({"/api/auth", "/api/v1/auth"})
public class CurrentUserController {
  private final GetCurrentUserUseCase getCurrentUserUseCase;

  @GetMapping("/me")
  public ResponseEntity<ApiResponse<CurrentUserResponse>> me() {
    return ResponseEntity.ok(getCurrentUserUseCase.execute(new CurrentUserQuery()));
  }
}
