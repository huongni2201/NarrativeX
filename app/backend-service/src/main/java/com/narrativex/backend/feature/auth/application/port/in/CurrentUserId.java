package com.narrativex.backend.feature.auth.application.port.in;

@FunctionalInterface
public interface CurrentUserId {
    String resolve(String requestedHeader);
}
