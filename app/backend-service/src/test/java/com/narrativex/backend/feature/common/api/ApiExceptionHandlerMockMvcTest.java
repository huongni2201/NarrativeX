package com.narrativex.backend.feature.common.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

class ApiExceptionHandlerMockMvcTest {
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(new ErrorContractController())
            .setControllerAdvice(new ApiExceptionHandler())
            .addFilters(new CorrelationIdFilter())
            .build();
  }

  @Test
  void malformedJsonReturnsStable400Contract() throws Exception {
    mockMvc
        .perform(
            post("/test/errors/body")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\": "))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
        .andExpect(jsonPath("$.message").value("The request is invalid."));
  }

  @Test
  void wrongEnumReturnsStable400Contract() throws Exception {
    mockMvc
        .perform(
            post("/test/errors/body")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"UNKNOWN\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  void pathTypeMismatchReturns400() throws Exception {
    mockMvc
        .perform(get("/test/errors/number/not-a-number"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  void missingRequiredParameterReturns400() throws Exception {
    mockMvc
        .perform(get("/test/errors/required"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  void dataIntegrityConflictReturnsRedacted409() throws Exception {
    mockMvc
        .perform(get("/test/errors/conflict"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("RESOURCE_CONFLICT"))
        .andExpect(jsonPath("$.message").value("The resource changed or conflicts with the requested operation."));
  }

  @Test
  void unexpectedFailureReturns500AndKeepsCorrelationId() throws Exception {
    mockMvc
        .perform(
            get("/test/errors/unexpected")
                .header(CorrelationIdFilter.HEADER_NAME, "contract-test-correlation"))
        .andExpect(status().isInternalServerError())
        .andExpect(header().string(CorrelationIdFilter.HEADER_NAME, "contract-test-correlation"))
        .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
        .andExpect(jsonPath("$.correlationId").value("contract-test-correlation"))
        .andExpect(jsonPath("$.message").value("An unexpected error occurred."));
  }

  enum Mode {
    SAFE
  }

  record BodyRequest(Mode mode) {}

  @RestController
  @RequestMapping("/test/errors")
  static class ErrorContractController {
    @PostMapping("/body")
    void body(@RequestBody BodyRequest request) {}

    @GetMapping("/number/{value}")
    void number(@PathVariable Long value) {}

    @GetMapping("/required")
    void required(@RequestParam String value) {}

    @GetMapping("/conflict")
    void conflict() {
      throw new DataIntegrityViolationException("duplicate key SQL detail must not leak");
    }

    @GetMapping("/unexpected")
    void unexpected() {
      throw new RuntimeException("database password must not leak");
    }
  }
}
