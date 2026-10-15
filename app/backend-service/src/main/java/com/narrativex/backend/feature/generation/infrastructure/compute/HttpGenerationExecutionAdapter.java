package com.narrativex.backend.feature.generation.infrastructure.compute;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeSubmissionReceipt;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTargetAssignment;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.port.out.ComputeTargetAssignmentStore;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
import com.narrativex.backend.feature.generation.infrastructure.compute.node.ComputeTarget;
import com.narrativex.backend.feature.generation.infrastructure.compute.node.ComputeTargetRegistry;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@Component
public class HttpGenerationExecutionAdapter implements GenerationExecutionPort {
  public static final String COMPUTE_MEDIA_TYPE = "application/vnd.narrativex.compute-v1+json";

  private final ComputeServiceProperties properties;
  private final HttpClient httpClient;
  private final ObjectMapper objectMapper;
  private final ComputeTargetRegistry registry;
  private final ComputeTargetAssignmentStore targetAssignments;

  @Autowired
  public HttpGenerationExecutionAdapter(
      ComputeServiceProperties properties,
      ObjectMapper objectMapper,
      @Autowired(required = false) ComputeTargetRegistry registry,
      @Autowired(required = false) ComputeTargetAssignmentStore targetAssignments) {
    this(
        properties,
        HttpClient.newBuilder().connectTimeout(properties.getConnectTimeout()).build(),
        objectMapper,
        registry,
        targetAssignments);
  }

  public HttpGenerationExecutionAdapter(
      ComputeServiceProperties properties, HttpClient httpClient, ObjectMapper objectMapper) {
    this(properties, httpClient, objectMapper, null, null);
  }

  public HttpGenerationExecutionAdapter(
      ComputeServiceProperties properties,
      HttpClient httpClient,
      ObjectMapper objectMapper,
      ComputeTargetRegistry registry) {
    this(properties, httpClient, objectMapper, registry, null);
  }

  public HttpGenerationExecutionAdapter(
      ComputeServiceProperties properties,
      HttpClient httpClient,
      ObjectMapper objectMapper,
      ComputeTargetRegistry registry,
      ComputeTargetAssignmentStore targetAssignments) {
    this.properties = properties;
    this.httpClient = httpClient;
    this.objectMapper = objectMapper;
    this.registry = registry;
    this.targetAssignments = targetAssignments;
  }

  private String selectTargetId(String executor) {
    if (registry == null) return ComputeTargetRegistry.DEFAULT_TARGET_ID;
    return registry
        .resolveTargetForExecutor(executor)
        .map(ComputeTarget::id)
        .orElseThrow(
            () -> new ComputeClientException("No online compute target supports " + executor));
  }

  private ComputeTargetAssignment pinTarget(ComputeTaskRequest request, String executor) {
    if (targetAssignments == null) {
      return new ComputeTargetAssignment(
          request.taskId(), request.attemptId(), executor, selectTargetId(executor));
    }
    var existing = targetAssignments.find(request.taskId(), request.attemptId());
    if (existing.isPresent()) {
      if (!executor.equals(existing.get().executor())) {
        throw new ComputeClientException("Compute attempt is pinned to a different executor");
      }
      return existing.get();
    }
    return targetAssignments.pin(
        request.taskId(), request.attemptId(), executor, selectTargetId(executor));
  }

  private ComputeTargetAssignment requirePinnedTarget(UUID taskId, UUID attemptId) {
    if (targetAssignments == null) {
      return new ComputeTargetAssignment(
          taskId, attemptId, "default", ComputeTargetRegistry.DEFAULT_TARGET_ID);
    }
    return targetAssignments
        .find(taskId, attemptId)
        .orElseThrow(
            () ->
                new ComputeClientException(
                    "No durable compute target is pinned to this task attempt"));
  }

  private String resolveBaseUrl(String executor, String targetId) {
    if (registry != null) {
      return resolveTarget(executor, targetId).baseUrl().replaceAll("/+$", "");
    }
    if (!ComputeTargetRegistry.DEFAULT_TARGET_ID.equals(targetId)) {
      throw new ComputeClientException("Pinned compute target is not configured");
    }
    return properties.getBaseUrl() != null
        ? properties.getBaseUrl().replaceAll("/+$", "")
        : "http://127.0.0.1:8010";
  }

  private String resolveMachineToken(String executor, String targetId) {
    if (registry != null) return resolveTarget(executor, targetId).machineToken();
    return properties.getMachineToken();
  }

  private ComputeTarget resolveTarget(String executor, String targetId) {
    ComputeTarget target =
        registry
            .findById(targetId)
            .orElseThrow(
                () -> new ComputeClientException("Pinned compute target is not registered"));
    if (!target.isReady()) {
      throw new ComputeClientException("Pinned compute target is not online");
    }
    if (!target.supportedExecutors().isEmpty() && !target.supportedExecutors().contains(executor)) {
      throw new ComputeClientException("Pinned compute target does not support " + executor);
    }
    if (target.baseUrl() == null || target.baseUrl().isBlank()) {
      throw new ComputeClientException("Pinned compute target has no endpoint");
    }
    return target;
  }

  @Override
  public ComputeSubmissionReceipt submitTask(ComputeTaskRequest request) {
    String executor = request.model() != null ? request.model().executor() : "default";
    ComputeTargetAssignment assignment = pinTarget(request, executor);
    String url = resolveBaseUrl(executor, assignment.targetId()) + "/v1/tasks";
    try {
      String jsonBody = objectMapper.writeValueAsString(request);
      HttpRequest.Builder builder =
          HttpRequest.newBuilder()
              .uri(URI.create(url))
              .timeout(properties.getReadTimeout())
              .header("Content-Type", COMPUTE_MEDIA_TYPE)
              .header("Accept", COMPUTE_MEDIA_TYPE)
              .header("Idempotency-Key", request.idempotencyKey())
              .POST(HttpRequest.BodyPublishers.ofString(jsonBody));

      String machineToken = resolveMachineToken(executor, assignment.targetId());
      if (machineToken != null && !machineToken.isBlank()) {
        builder.header("Authorization", "Bearer " + machineToken);
      }

      HttpResponse<String> response =
          httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() == 202) {
        ComputeObservationDto observation =
            objectMapper.readValue(response.body(), ComputeObservationDto.class);
        return new ComputeSubmissionReceipt(
            request.taskId(),
            request.attemptId(),
            observation.executionHandle(),
            observation.state(),
            observation.sequence());
      } else {
        throw new ComputeClientException(response.statusCode(), response.body());
      }
    } catch (IOException e) {
      throw new ComputeClientException("Failed to communicate with compute service at " + url, e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ComputeClientException("Interrupted while communicating with compute service", e);
    }
  }

  @Override
  public ComputeObservationDto queryTask(UUID taskId, UUID attemptId) {
    ComputeTargetAssignment assignment = requirePinnedTarget(taskId, attemptId);
    String executor = assignment.executor();
    String url =
        resolveBaseUrl(executor, assignment.targetId())
            + "/v1/tasks/"
            + taskId
            + "/attempts/"
            + attemptId;
    try {
      HttpRequest.Builder builder =
          HttpRequest.newBuilder()
              .uri(URI.create(url))
              .timeout(properties.getReadTimeout())
              .header("Accept", COMPUTE_MEDIA_TYPE)
              .GET();

      String machineToken = resolveMachineToken(executor, assignment.targetId());
      if (machineToken != null && !machineToken.isBlank()) {
        builder.header("Authorization", "Bearer " + machineToken);
      }

      HttpResponse<String> response =
          httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() == 200) {
        return objectMapper.readValue(response.body(), ComputeObservationDto.class);
      } else if (response.statusCode() == 404) {
        return null;
      } else {
        throw new ComputeClientException(response.statusCode(), response.body());
      }
    } catch (IOException e) {
      throw new ComputeClientException("Failed to query compute service at " + url, e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ComputeClientException("Interrupted while querying compute service", e);
    }
  }

  @Override
  public java.util.Optional<ComputeObservationDto> cancelTask(UUID taskId, UUID attemptId) {
    ComputeTargetAssignment assignment = requirePinnedTarget(taskId, attemptId);
    String executor = assignment.executor();
    String url =
        resolveBaseUrl(executor, assignment.targetId())
            + "/v1/tasks/"
            + taskId
            + "/attempts/"
            + attemptId
            + ":cancel";
    try {
      HttpRequest.Builder builder =
          HttpRequest.newBuilder()
              .uri(URI.create(url))
              .timeout(properties.getReadTimeout())
              .header("Accept", COMPUTE_MEDIA_TYPE)
              .POST(HttpRequest.BodyPublishers.noBody());

      String machineToken = resolveMachineToken(executor, assignment.targetId());
      if (machineToken != null && !machineToken.isBlank()) {
        builder.header("Authorization", "Bearer " + machineToken);
      }

      HttpResponse<String> response =
          httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() != 200
          && response.statusCode() != 202
          && response.statusCode() != 404) {
        throw new ComputeClientException(response.statusCode(), response.body());
      }
      if (response.statusCode() == 404 || response.body() == null || response.body().isBlank()) {
        return java.util.Optional.empty();
      }
      return java.util.Optional.of(
          objectMapper.readValue(response.body(), ComputeObservationDto.class));
    } catch (IOException e) {
      throw new ComputeClientException("Failed to cancel compute task at " + url, e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ComputeClientException("Interrupted while canceling compute task", e);
    }
  }

  @Override
  public java.util.Optional<
          com.narrativex.backend.feature.generation.application.model.compute.WorkerCapabilitiesDto>
      fetchCapabilities() {
    String targetId = selectTargetId("ltx");
    String url = resolveBaseUrl("ltx", targetId) + "/v1/capabilities";
    try {
      HttpRequest.Builder builder =
          HttpRequest.newBuilder()
              .uri(URI.create(url))
              .timeout(properties.getReadTimeout())
              .header("Accept", COMPUTE_MEDIA_TYPE)
              .GET();

      String machineToken = resolveMachineToken("ltx", targetId);
      if (machineToken != null && !machineToken.isBlank()) {
        builder.header("Authorization", "Bearer " + machineToken);
      }

      HttpResponse<String> response =
          httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() == 200) {
        return java.util.Optional.ofNullable(
            objectMapper.readValue(
                response.body(),
                com.narrativex.backend.feature.generation.application.model.compute
                    .WorkerCapabilitiesDto.class));
      } else {
        log.warn(
            "Compute service returned status {} for /v1/capabilities at {}",
            response.statusCode(),
            url);
        return java.util.Optional.empty();
      }
    } catch (Exception e) {
      log.debug("Worker unreachable at {}: {}", url, e.getMessage());
      return java.util.Optional.empty();
    }
  }
}
