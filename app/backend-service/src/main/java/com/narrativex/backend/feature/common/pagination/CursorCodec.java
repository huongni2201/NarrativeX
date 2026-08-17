package com.narrativex.backend.feature.common.pagination;

import com.narrativex.backend.feature.common.domain.exception.DomainValidationException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Base64;

public final class CursorCodec {
    private static final String SEPARATOR = "|";

    private CursorCodec() {
    }

    public static String encode(Instant updatedAt, long id) {
        String value = updatedAt + SEPARATOR + id;
        return Base64.getUrlEncoder().withoutPadding()
            .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    public static CursorKey decode(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }

        try {
            String decoded = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
            int separatorIndex = decoded.lastIndexOf(SEPARATOR);
            if (separatorIndex <= 0 || separatorIndex == decoded.length() - 1) {
                throw new DomainValidationException("Invalid pagination cursor");
            }
            Instant updatedAt = Instant.parse(decoded.substring(0, separatorIndex));
            long id = Long.parseLong(decoded.substring(separatorIndex + 1));
            return new CursorKey(updatedAt, id);
        } catch (IllegalArgumentException | DateTimeParseException exception) {
            if (exception instanceof DomainValidationException domainValidationException) {
                throw domainValidationException;
            }
            throw new DomainValidationException("Invalid pagination cursor", exception);
        }
    }
}
