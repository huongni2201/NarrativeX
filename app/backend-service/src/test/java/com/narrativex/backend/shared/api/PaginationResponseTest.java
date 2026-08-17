package com.narrativex.backend.shared.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.narrativex.backend.shared.application.response.PaginationResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

class PaginationResponseTest {
    @Test
    void mapsPageMetadataAndContent() {
        var page = new PageImpl<>(List.of("first", "second"), PageRequest.of(1, 2), 5);
        PaginationResponse<String> response = PaginationResponse.from(page);
        assertEquals(List.of("first", "second"), response.content());
        assertEquals(1, response.page());
        assertEquals(2, response.size());
        assertEquals(5, response.totalElements());
        assertEquals(3, response.totalPages());
        assertTrue(response.hasNext());
        assertTrue(response.hasPrevious());
    }
}
