package com.narrativex.backend.feature.project.application.query;

import org.springframework.data.domain.Pageable;

public record ProjectListQuery(String ownerId, Pageable pageable) {
}
