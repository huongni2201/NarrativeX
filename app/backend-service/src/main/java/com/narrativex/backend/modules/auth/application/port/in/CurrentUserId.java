package com.narrativex.backend.modules.auth.application.port.in;

@FunctionalInterface
public interface CurrentUserId {
    String resolve(String requestedHeader);
}
