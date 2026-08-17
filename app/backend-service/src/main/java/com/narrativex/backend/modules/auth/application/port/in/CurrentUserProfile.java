package com.narrativex.backend.modules.auth.application.port.in;

import com.narrativex.backend.modules.auth.api.response.CurrentUserResponse;

public interface CurrentUserProfile {
    CurrentUserResponse current();
}
