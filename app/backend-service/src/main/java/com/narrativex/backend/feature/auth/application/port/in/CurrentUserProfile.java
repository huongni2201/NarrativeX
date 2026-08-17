package com.narrativex.backend.feature.auth.application.port.in;

import com.narrativex.backend.feature.auth.api.response.CurrentUserResponse;

public interface CurrentUserProfile {
    CurrentUserResponse current();
}
