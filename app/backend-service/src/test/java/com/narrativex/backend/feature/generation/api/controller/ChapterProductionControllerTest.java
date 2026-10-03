package com.narrativex.backend.feature.generation.api.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

import com.narrativex.backend.feature.common.domain.enums.GenerationStrategy;
import com.narrativex.backend.feature.generation.api.response.TakeResponse;
import com.narrativex.backend.feature.generation.application.query.ChapterProductionView;
import com.narrativex.backend.feature.generation.application.usecase.GenerateShotTakeUseCase;
import com.narrativex.backend.feature.generation.application.usecase.GetChapterProductionUseCase;
import com.narrativex.backend.feature.generation.application.usecase.SelectTakeUseCase;
import com.narrativex.backend.feature.generation.application.usecase.UpdateShotStrategyUseCase;
import com.narrativex.backend.feature.generation.domain.value.SelectedTake;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

class ChapterProductionControllerTest {
  private final GetChapterProductionUseCase getChapterProductionUseCase =
      mock(GetChapterProductionUseCase.class);
  private final GenerateShotTakeUseCase generateShotTakeUseCase =
      mock(GenerateShotTakeUseCase.class);
  private final SelectTakeUseCase selectTakeUseCase = mock(SelectTakeUseCase.class);
  private final UpdateShotStrategyUseCase updateShotStrategyUseCase =
      mock(UpdateShotStrategyUseCase.class);

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        standaloneSetup(
                new ChapterProductionController(
                    getChapterProductionUseCase,
                    generateShotTakeUseCase,
                    selectTakeUseCase,
                    updateShotStrategyUseCase))
            .setControllerAdvice(
                new com.narrativex.backend.feature.common.api.ApiExceptionHandler())
            .build();
  }

  @Test
  void getProductionReturnsOk() throws Exception {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();

    ChapterProductionView response =
        new ChapterProductionView(chapterId, "Chapter 1", 1, 10, 5, 2, 50, "READY", List.of());
    when(getChapterProductionUseCase.execute(projectId, chapterId)).thenReturn(response);

    mockMvc
        .perform(
            get(
                "/api/v1/projects/{projectId}/chapters/{chapterId}/production",
                projectId,
                chapterId))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.chapterId").value(chapterId.toString()))
        .andExpect(jsonPath("$.data.totalShots").value(10))
        .andExpect(jsonPath("$.data.readyShots").value(5))
        .andExpect(jsonPath("$.data.selectedShots").value(2));
  }

  @Test
  void getProductionStatusReturnsOk() throws Exception {
    UUID projectId = UUID.randomUUID();
    UUID chapterId = UUID.randomUUID();

    com.narrativex.backend.feature.generation.application.query.ChapterProductionStatusView
        statusResponse =
            new com.narrativex.backend.feature.generation.application.query
                .ChapterProductionStatusView(
                chapterId, true, true, true, 6, 0, 2, 1, 2, 1, 0, 0, 2, true, false, false, 58,
                null);
    when(getChapterProductionUseCase.getStatus(projectId, chapterId)).thenReturn(statusResponse);

    mockMvc
        .perform(
            get(
                "/api/v1/projects/{projectId}/chapters/{chapterId}/production/status",
                projectId,
                chapterId))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.chapterId").value(chapterId.toString()))
        .andExpect(jsonPath("$.data.totalShots").value(6))
        .andExpect(jsonPath("$.data.generatingShots").value(2))
        .andExpect(jsonPath("$.data.overallProgressPercent").value(58));
  }

  @Test
  void generateTakeReturnsAccepted() throws Exception {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();

    TakeResponse response =
        new TakeResponse(
            takeId,
            shotId,
            1,
            "ltx",
            "ltx-2.5-nvfp4",
            GenerationStrategy.TEXT_TO_VIDEO,
            null,
            4000L,
            "{}",
            "PENDING",
            null,
            null,
            null,
            "PENDING",
            Instant.now(),
            jobId);

    when(generateShotTakeUseCase.execute(
            any(
                com.narrativex.backend.feature.generation.application.command
                    .GenerateShotTakeCommand.class)))
        .thenReturn(response);

    mockMvc
        .perform(
            post("/api/v1/projects/{projectId}/shots/{shotId}/takes", projectId, shotId)
                .header("Idempotency-Key", "transport-attempt-1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"strategy\":\"TEXT_TO_VIDEO\",\"seed\":42}"))
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.id").value(takeId.toString()))
        .andExpect(jsonPath("$.data.shotId").value(shotId.toString()))
        .andExpect(jsonPath("$.data.provider").value("ltx"))
        .andExpect(jsonPath("$.data.jobId").value(jobId.toString()))
        .andExpect(jsonPath("$.data.generationJobId").value(jobId.toString()))
        .andExpect(jsonPath("$.data.status").value("PENDING"));
    verify(generateShotTakeUseCase)
        .execute(
            org.mockito.ArgumentMatchers.argThat(
                command ->
                    "transport-attempt-1".equals(command.idempotencyKey())
                        && Long.valueOf(42).equals(command.seed())));
  }

  @Test
  void missingTakeIdempotencyHeaderIsBadRequest() throws Exception {
    mockMvc
        .perform(
            post(
                "/api/v1/projects/{projectId}/shots/{shotId}/takes",
                UUID.randomUUID(),
                UUID.randomUUID()))
        .andExpect(status().isBadRequest());
    org.mockito.Mockito.verifyNoInteractions(generateShotTakeUseCase);
  }

  @Test
  void takeReplayConflictReturns409() throws Exception {
    when(generateShotTakeUseCase.execute(any()))
        .thenThrow(
            new com.narrativex.backend.feature.common.exception.ResourceConflictException(
                "Idempotency-Key reused with different shot inputs"));
    mockMvc
        .perform(
            post(
                    "/api/v1/projects/{projectId}/shots/{shotId}/takes",
                    UUID.randomUUID(),
                    UUID.randomUUID())
                .header("Idempotency-Key", "stable-key"))
        .andExpect(status().isConflict());
  }

  @Test
  void selectTakeReturnsOk() throws Exception {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();
    UUID takeId = UUID.randomUUID();

    SelectedTake selected = new SelectedTake(shotId, takeId, 0L, 3000L);
    when(selectTakeUseCase.execute(projectId, shotId, takeId, 0L, 3000L)).thenReturn(selected);

    mockMvc
        .perform(
            put("/api/v1/projects/{projectId}/shots/{shotId}/selected-take", projectId, shotId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"takeId\":\"" + takeId + "\",\"sourceInMs\":0,\"sourceOutMs\":3000}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.data.takeId").value(takeId.toString()))
        .andExpect(jsonPath("$.data.sourceInMs").value(0))
        .andExpect(jsonPath("$.data.sourceOutMs").value(3000));
  }

  @Test
  void updateStrategyReturnsOk() throws Exception {
    UUID projectId = UUID.randomUUID();
    UUID shotId = UUID.randomUUID();

    mockMvc
        .perform(
            put("/api/v1/projects/{projectId}/shots/{shotId}/strategy", projectId, shotId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"strategy\":\"IMAGE_TO_VIDEO\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true));

    verify(updateShotStrategyUseCase).execute(projectId, shotId, GenerationStrategy.IMAGE_TO_VIDEO);
  }
}
