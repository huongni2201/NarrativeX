package com.narrativex.backend.modules.project.application.query;

import org.springframework.data.domain.Pageable;

public record ProjectListQuery(String ownerId, Pageable pageable) {
}
