package com.narrativex.backend.feature.generation.infrastructure.compute;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.SubmitTaskResult;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
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

  @Autowired
  public HttpGenerationExecutionAdapter(
      ComputeServiceProperties properties,
      ObjectMapper objectMapper,
      @Autowired(required = false) ComputeTargetRegistry registry) {
    this(
        properties,
        HttpClient.newBuilder().connectTimeout(properties.getConnectTimeout()).build(),
        objectMapper,
        registry);
  }

  public HttpGenerationExecutionAdapter(
      ComputeServiceProperties properties, HttpClient httpClient, ObjectMapper objectMapper) {
    this(properties, httpClient, objectMapper, null);
  }

  public HttpGenerationExecutionAdapter(
      ComputeServiceProperties properties,
      HttpClient httpClient,
      ObjectMapper objectMapper,
      ComputeTargetRegistry registry) {
    this.properties = properties;
    this.httpClient = httpClient;
    this.objectMapper = objectMapper;
    this.registry = registry;
  }

  private String resolveBaseUrl(String executor) {
    if (registry != null) {
      var target = registry.resolveTargetForExecutor(executor);
      if (target.isPresent()
          && target.get().baseUrl() != null
          && !target.get().baseUrl().isBlank()) {
        return target.get().baseUrl().replaceAll("/+$", "");
      }
    }
    return properties.getBaseUrl() != null
        ? properties.getBaseUrl().replaceAll("/+$", "")
        : "http://127.0.0.1:8010";
  }

  private String resolveMachineToken(String executor) {
    if (registry != null) {
      var target = registry.resolveTargetForExecutor(executor);
      if (target.isPresent()
          && target.get().machineToken() != null
          && !target.get().machineToken().isBlank()) {
        return target.get().machineToken();
      }
    }
    return properties.getMachineToken();
  }

  @Override
  public SubmitTaskResult submitTask(ComputeTaskRequest request) {
    String executor = request.model() != null ? request.model().executor() : "default";
    String url = resolveBaseUrl(executor) + "/v1/tasks";
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

      String machineToken = resolveMachineToken(executor);
      if (machineToken != null && !machineToken.isBlank()) {
        builder.header("Authorization", "Bearer " + machineToken);
      }

      HttpResponse<String> response =
          httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() == 202) {
        ComputeObservationDto observation =
            objectMapper.readValue(response.body(), ComputeObservationDto.class);
        return new SubmitTaskResult(request.taskId(), request.attemptId(), observation.state());
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
    String url = resolveBaseUrl("default") + "/v1/tasks/" + taskId + "/attempts/" + attemptId;
    try {
      HttpRequest.Builder builder =
          HttpRequest.newBuilder()
              .uri(URI.create(url))
              .timeout(properties.getReadTimeout())
              .header("Accept", COMPUTE_MEDIA_TYPE)
              .GET();

      String machineToken = resolveMachineToken("default");
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
  public void cancelTask(UUID taskId, UUID attemptId) {
    String url =
        resolveBaseUrl("default") + "/v1/tasks/" + taskId + "/attempts/" + attemptId + ":cancel";
    try {
      HttpRequest.Builder builder =
          HttpRequest.newBuilder()
              .uri(URI.create(url))
              .timeout(properties.getReadTimeout())
              .header("Accept", COMPUTE_MEDIA_TYPE)
              .POST(HttpRequest.BodyPublishers.noBody());

      String machineToken = resolveMachineToken("default");
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
    } catch (IOException e) {
      throw new ComputeClientException("Failed to cancel compute task at " + url, e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ComputeClientException("Interrupted while canceling compute task", e);
    }
  }
}
