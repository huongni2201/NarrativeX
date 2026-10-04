package com.narrativex.backend.feature.generation.infrastructure.compute;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeSubmissionReceipt;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTargetAssignment;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.ModelRefDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskArtifactsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskConstraintsDto;
import com.narrativex.backend.feature.generation.application.model.compute.TaskDescriptorDto;
import com.narrativex.backend.feature.generation.application.port.out.ComputeTargetAssignmentStore;
import com.narrativex.backend.feature.generation.infrastructure.compute.node.ComputeTarget;
import com.narrativex.backend.feature.generation.infrastructure.compute.node.ComputeTargetRegistry;
import com.narrativex.backend.feature.generation.infrastructure.compute.node.ComputeTargetStatus;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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

    ComputeSubmissionReceipt result = adapter.submitTask(request);

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

  @Test
  @SuppressWarnings("unchecked")
  void submissionReconcileAndCancelUseTheSamePinnedTarget() throws Exception {
    UUID taskId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    String targetId = "a-worker";
    var assignment = new ComputeTargetAssignment(taskId, attemptId, "ltx", targetId);
    var registry = new ComputeTargetRegistry(properties);
    registry.register(
        new ComputeTarget(
            targetId,
            "Worker A",
            "http://worker-a:8010",
            "worker-a-token",
            ComputeTargetStatus.ONLINE,
            Set.of("ltx"),
            Instant.now()));
    var assignments = mock(ComputeTargetAssignmentStore.class);
    when(assignments.find(taskId, attemptId))
        .thenReturn(Optional.empty(), Optional.of(assignment), Optional.of(assignment));
    when(assignments.pin(taskId, attemptId, "ltx", targetId)).thenReturn(assignment);
    adapter =
        new HttpGenerationExecutionAdapter(
            properties, httpClient, objectMapper, registry, assignments);

    var request =
        new ComputeTaskRequest(
            "1.0",
            taskId,
            attemptId,
            "idemp-key-1",
            "fingerprint-1",
            new TaskDescriptorDto("video.generate", "1.1"),
            new ModelRefDto("ltx", "ltx-model", "revision-1"),
            new TaskConstraintsDto(Instant.parse("2026-10-05T12:00:00Z"), 300),
            Map.of("prompt", "A moving scene"),
            TaskArtifactsDto.empty());
    HttpResponse<String> accepted = mock(HttpResponse.class);
    when(accepted.statusCode()).thenReturn(202);
    when(accepted.body())
        .thenReturn(
            "{\"protocolVersion\":\"1.0\",\"taskId\":\""
                + taskId
                + "\",\"attemptId\":\""
                + attemptId
                + "\",\"state\":\"ACCEPTED\",\"sequence\":1,\"observedAt\":\"2026-10-04T00:00:00Z\",\"outputs\":[]}");
    HttpResponse<String> missing = mock(HttpResponse.class);
    when(missing.statusCode()).thenReturn(404);
    HttpResponse<String> canceled = mock(HttpResponse.class);
    when(canceled.statusCode()).thenReturn(200);
    when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
        .thenReturn(accepted, missing, canceled);

    adapter.submitTask(request);
    assertThat(adapter.queryTask(taskId, attemptId)).isNull();
    adapter.cancelTask(taskId, attemptId);

    ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
    verify(httpClient, org.mockito.Mockito.times(3))
        .send(captor.capture(), any(HttpResponse.BodyHandler.class));
    var requests = captor.getAllValues();
    assertThat(requests.get(0).uri().toString()).isEqualTo("http://worker-a:8010/v1/tasks");
    assertThat(requests.get(1).uri().toString())
        .isEqualTo("http://worker-a:8010/v1/tasks/" + taskId + "/attempts/" + attemptId);
    assertThat(requests.get(2).uri().toString())
        .isEqualTo(
            "http://worker-a:8010/v1/tasks/" + taskId + "/attempts/" + attemptId + ":cancel");
    assertThat(requests.get(0).headers().firstValue("Authorization"))
        .contains("Bearer worker-a-token");
    assertThat(requests.get(1).headers().firstValue("Authorization"))
        .contains("Bearer worker-a-token");
    assertThat(requests.get(2).headers().firstValue("Authorization"))
        .contains("Bearer worker-a-token");
    var order = inOrder(assignments, httpClient);
    order.verify(assignments).find(taskId, attemptId);
    order.verify(assignments).pin(taskId, attemptId, "ltx", targetId);
    order.verify(httpClient).send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class));
  }

  @Test
  void reconciliationDoesNotFallBackWhenPinnedTargetIsMissing() {
    UUID taskId = UUID.randomUUID();
    UUID attemptId = UUID.randomUUID();
    var assignments = mock(ComputeTargetAssignmentStore.class);
    when(assignments.find(taskId, attemptId))
        .thenReturn(
            Optional.of(new ComputeTargetAssignment(taskId, attemptId, "ltx", "retired-worker")));
    adapter =
        new HttpGenerationExecutionAdapter(
            properties,
            httpClient,
            objectMapper,
            new ComputeTargetRegistry(properties),
            assignments);

    assertThatThrownBy(() -> adapter.queryTask(taskId, attemptId))
        .isInstanceOf(ComputeClientException.class)
        .hasMessageContaining("Pinned compute target is not registered");
    org.mockito.Mockito.verifyNoInteractions(httpClient);
  }
}
