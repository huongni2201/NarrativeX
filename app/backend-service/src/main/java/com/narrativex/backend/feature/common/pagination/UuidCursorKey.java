package com.narrativex.backend.feature.common.pagination;

import java.time.Instant;
import java.util.UUID;

public record UuidCursorKey(Instant updatedAt, UUID id) {}
