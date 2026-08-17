package com.narrativex.backend.shared.api;

import com.narrativex.backend.shared.api.ApiResponse;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Exposes the session-bound CSRF token to the credentialed browser client. */
@RestController
@RequestMapping("/api/v1/auth")
public class CsrfTokenController {

    @GetMapping("/csrf")
    public ResponseEntity<ApiResponse<CsrfToken>> csrf(CsrfToken token) {
        return ResponseEntity.ok(ApiResponse.success(token));
    }
}
