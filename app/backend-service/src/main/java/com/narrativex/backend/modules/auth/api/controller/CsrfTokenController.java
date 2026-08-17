package com.narrativex.backend.modules.auth.api.controller;

import com.narrativex.backend.modules.auth.application.query.CsrfTokenQuery;
import com.narrativex.backend.modules.auth.application.response.CsrfTokenResponse;
import com.narrativex.backend.modules.auth.application.usecase.GetCsrfTokenUseCase;
import com.narrativex.backend.shared.application.response.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class CsrfTokenController {

    private final GetCsrfTokenUseCase getCsrfTokenUseCase;

    public CsrfTokenController(GetCsrfTokenUseCase getCsrfTokenUseCase) {
        this.getCsrfTokenUseCase = getCsrfTokenUseCase;
    }

    @GetMapping("/csrf")
    public ResponseEntity<ApiResponse<CsrfTokenResponse>> csrf(CsrfToken token) {
        CsrfTokenQuery query = new CsrfTokenQuery(token.getToken(), token.getHeaderName());
        return ResponseEntity.ok(getCsrfTokenUseCase.execute(query));
    }
}
