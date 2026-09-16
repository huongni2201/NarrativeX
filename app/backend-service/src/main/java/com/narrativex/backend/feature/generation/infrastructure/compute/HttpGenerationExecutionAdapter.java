package com.narrativex.backend.feature.generation.infrastructure.compute;

import com.narrativex.backend.feature.generation.application.model.compute.ComputeObservationDto;
import com.narrativex.backend.feature.generation.application.model.compute.ComputeTaskRequest;
import com.narrativex.backend.feature.generation.application.model.compute.SubmitTaskResult;
import com.narrativex.backend.feature.generation.application.port.out.GenerationExecutionPort;
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

  @Autowired
  public HttpGenerationExecutionAdapter(
      ComputeServiceProperties properties, ObjectMapper objectMapper) {
    this(
        properties,
        HttpClient.newBuilder().connectTimeout(properties.getConnectTimeout()).build(),
        objectMapper);
  }

  public HttpGenerationExecutionAdapter(
      ComputeServiceProperties properties, HttpClient httpClient, ObjectMapper objectMapper) {
    this.properties = properties;
    this.httpClient = httpClient;
    this.objectMapper = objectMapper;
  }

  @Override
  public SubmitTaskResult submitTask(ComputeTaskRequest request) {
    String url = properties.getBaseUrl().replaceAll("/+$", "") + "/v1/tasks";
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

      if (properties.getMachineToken() != null && !properties.getMachineToken().isBlank()) {
        builder.header("Authorization", "Bearer " + properties.getMachineToken());
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
    String url =
        properties.getBaseUrl().replaceAll("/+$", "")
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

      if (properties.getMachineToken() != null && !properties.getMachineToken().isBlank()) {
        builder.header("Authorization", "Bearer " + properties.getMachineToken());
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
        properties.getBaseUrl().replaceAll("/+$", "")
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

      if (properties.getMachineToken() != null && !properties.getMachineToken().isBlank()) {
        builder.header("Authorization", "Bearer " + properties.getMachineToken());
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
