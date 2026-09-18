package com.narrativex.backend.feature.generation.infrastructure.compute;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.ModelRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.SubmitTaskResult;
import com.narrativex.backend.feature.generation.application.model.compute.TaskArtifactsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskConstraintsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskDescriptorDto;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

class HttpGenerationExecutionAdapterTest {

  private ComputeServiceProperties properties;
  private HttpClient httpClient;
  private ObjectMapper objectMapper;
  private HttpGenerationExecutionAdapter adapter;

  @BeforeEach
  void setUp() {
    properties = new ComputeServiceProperties();
    properties.setBaseUrl("http://127.0.0.1:8010");
    properties.setMachineToken("secret-token-123");
    properties.setConnectTimeout(Duration.ofSeconds(5));
    properties.setReadTimeout(Duration.ofSeconds(30));

    httpClient = mock(HttpClient.class);
    objectMapper = JsonMapper.builder().build();
    adapter = new HttpGenerationExecutionAdapter(properties, httpClient, objectMapper);
  }

  @Test
  @SuppressWarnings("unchecked")
  void submitTaskSendsHeadersAndReturnsResultOnAccepted() throws Exception {
    UUID taskId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    ComputeTaskRequest request =
        new ComputeTaskRequest(
            "1.0",
            taskId,
            attemptId,
            "idemp-key-1",
            "fingerprint-1",
            new TaskDescriptorDto("image.generate", "1.0"),
            new ModelRefDto("realvisxl", "realvisxl-checkpoint.safetensors", "default"),
            new TaskConstraintsDto(Instant.parse("2026-09-14T12:00:00Z"), 300),
            Map.of("prompt", "A cinematic scene"),
            TaskArtifactsDto.empty());

    String acceptedJson =
        """
        {
          "protocolVersion": "1.0",
          "taskId": "%s",
          "attemptId": "%s",
          "state": "ACCEPTED",
          "sequence": 1,
          "observedAt": "2026-09-14T11:00:00Z",
          "outputs": []
        }
        """
            .formatted(taskId, attemptId);

    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(202);
    when(response.body()).thenReturn(acceptedJson);
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);

    SubmitTaskResult result = adapter.submitTask(request);

    assertThat(result.taskId()).isEqualTo(taskId);
    assertThat(result.attemptId()).isEqualTo(attemptId);
    assertThat(result.state()).isEqualTo("ACCEPTED");

    ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
    verify(httpClient).send(captor.capture(), any(HttpResponse.BodyHandler.class));
    HttpRequest sent = captor.getValue();

    assertThat(sent.uri().toString()).isEqualTo("http://127.0.0.1:8010/v1/tasks");
    assertThat(sent.method()).isEqualTo("POST");
    assertThat(sent.headers().firstValue("Content-Type"))
        .contains("application/vnd.narrativex.compute-v1+json");
    assertThat(sent.headers().firstValue("Accept"))
        .contains("application/vnd.narrativex.compute-v1+json");
    assertThat(sent.headers().firstValue("Authorization")).contains("Bearer secret-token-123");
    assertThat(sent.headers().firstValue("Idempotency-Key")).contains("idemp-key-1");
  }

  @Test
  @SuppressWarnings("unchecked")
  void submitTaskThrowsOnConflictOrFailure() throws Exception {
    ComputeTaskRequest request =
        new ComputeTaskRequest(
            "1.0",
            UUID.randomUUID(),
            UUID.randomUUID(),
            "idemp-key-1",
            "fingerprint-1",
            new TaskDescriptorDto("image.generate", "1.0"),
            new ModelRefDto("realvisxl", "realvisxl-checkpoint.safetensors", "default"),
            new TaskConstraintsDto(Instant.parse("2026-09-14T12:00:00Z"), 300),
            Map.of("prompt", "Hello"),
            TaskArtifactsDto.empty());

    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(409);
    when(response.body()).thenReturn("{\"error\":\"Conflict\"}");
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);

    assertThatThrownBy(() -> adapter.submitTask(request))
        .isInstanceOf(ComputeClientException.class)
        .hasMessageContaining("HTTP 409");
  }

  @Test
  @SuppressWarnings("unchecked")
  void queryTaskReturnsObservation() throws Exception {
    UUID taskId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();

    String succeededJson =
        """
        {
          "protocolVersion": "1.0",
          "taskId": "%s",
          "attemptId": "%s",
          "state": "SUCCEEDED",
          "sequence": 5,
          "observedAt": "2026-09-14T11:05:00Z",
          "executionHandle": "realvisxl:handle-1",
          "progress": 1.0,
          "outputs": [
            {
              "artifactId": "%s",
              "role": "image",
              "mediaType": "image/png",
              "sizeBytes": 128,
              "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
            }
          ]
        }
        """
            .formatted(taskId, attemptId, UUID.randomUUID());

    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(200);
    when(response.body()).thenReturn(succeededJson);
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);

    ComputeObservationDto obs = adapter.queryTask(taskId, attemptId);

    assertThat(obs).isNotNull();
    assertThat(obs.taskId()).isEqualTo(taskId);
    assertThat(obs.attemptId()).isEqualTo(attemptId);
    assertThat(obs.state()).isEqualTo("SUCCEEDED");
    assertThat(obs.isSucceeded()).isTrue();
    assertThat(obs.executionHandle()).isEqualTo("realvisxl:handle-1");
    assertThat(obs.outputs()).hasSize(1);
    assertThat(obs.outputs().get(0).role()).isEqualTo("image");
  }

  @Test
  @SuppressWarnings("unchecked")
  void queryTaskReturnsNullOnNotFound() throws Exception {
    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(404);
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);

    ComputeObservationDto obs = adapter.queryTask(UUID.randomUUID(), UUID.randomUUID());
    assertThat(obs).isNull();
  }

  @Test
  @SuppressWarnings("unchecked")
  void cancelTaskSendsPostToCancelEndpoint() throws Exception {
    UUID taskId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();

    HttpResponse<String> response = mock(HttpResponse.class);
    when(response.statusCode()).thenReturn(200);
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(response);

    adapter.cancelTask(taskId, attemptId);

    ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
    verify(httpClient).send(captor.capture(), any(HttpResponse.BodyHandler.class));
    HttpRequest sent = captor.getValue();

    assertThat(sent.uri().toString())
        .isEqualTo(
            "http://127.0.0.1:8010/v1/tasks/" + taskId + "/attempts/" + attemptId + ":cancel");
    assertThat(sent.method()).isEqualTo("POST");
    assertThat(sent.headers().firstValue("Authorization")).contains("Bearer secret-token-123");
  }
}
