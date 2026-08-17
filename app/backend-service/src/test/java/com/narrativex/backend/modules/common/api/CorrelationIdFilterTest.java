package com.narrativex.backend.modules.common.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class CorrelationIdFilterTest {
    @Test
    void acceptsSafeCorrelationIdAndReturnsItInResponse() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/projects");
        request.addHeader(CorrelationIdFilter.HEADER_NAME, "trace-123");
        MockHttpServletResponse response = new MockHttpServletResponse();
        new CorrelationIdFilter().doFilter(request, response, (FilterChain) (req, res) -> { });
        assertEquals("trace-123", response.getHeader(CorrelationIdFilter.HEADER_NAME));
        assertEquals("trace-123", request.getAttribute(CorrelationIdFilter.REQUEST_ATTRIBUTE));
    }
    @Test
    void replacesInvalidCorrelationId() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/projects");
        request.addHeader(CorrelationIdFilter.HEADER_NAME, "line\nforged");
        MockHttpServletResponse response = new MockHttpServletResponse();
        new CorrelationIdFilter().doFilter(request, response, (req, res) -> { });
        String correlationId = response.getHeader(CorrelationIdFilter.HEADER_NAME);
        assertNotEquals("line\nforged", correlationId);
        assertTrue(correlationId != null && !correlationId.isBlank());
    }
}
