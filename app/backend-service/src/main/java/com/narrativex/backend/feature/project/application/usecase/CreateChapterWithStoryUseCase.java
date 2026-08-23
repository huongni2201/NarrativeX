package com.narrativex.backend.feature.project.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.command.CreateChapterWithStoryCommand;
import com.narrativex.backend.feature.project.application.command.CreateStoryVersionCommand;
import com.narrativex.backend.feature.project.application.port.in.ProjectAccess;
import com.narrativex.backend.feature.project.application.port.out.ChapterCreationIdempotencyRepository;
import com.narrativex.backend.feature.project.application.port.out.StoryVersionRepository;
import com.narrativex.backend.feature.project.domain.aggregate.Project;
import com.narrativex.backend.feature.project.domain.entity.StoryVersion;
import com.narrativex.backend.feature.storyboard.api.response.ChapterResponse;
import com.narrativex.backend.feature.storyboard.application.command.CreateChapterCommand;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import com.narrativex.backend.feature.storyboard.application.usecase.CreateChapterUseCase;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Application orchestrator for the cross-feature chapter/story creation workflow. */
@Service
@RequiredArgsConstructor
public class CreateChapterWithStoryUseCase {
  private final CurrentUserId currentUserId;
  private final ProjectAccess projectAccess;
  private final StoryVersionRepository storyVersionRepository;
  private final CreateStoryVersionUseCase createStoryVersionUseCase;
  private final CreateChapterUseCase createChapterUseCase;
  private final ChapterRepository chapterRepository;
  private final ChapterCreationIdempotencyRepository idempotencyRepository;

  @Transactional
  public ApiResponse<ChapterResponse> execute(CreateChapterWithStoryCommand command) {
    requireIdempotencyKey(command.idempotencyKey());
    String ownerId = currentUserId.get();
    Project project = projectAccess.findOwnedProjectForUpdate(command.projectId(), ownerId);
    String fingerprint = fingerprint(command);
    var reservation =
        idempotencyRepository
            .reserve(ownerId, command.projectId(), command.idempotencyKey(), fingerprint)
            .orElseThrow(() -> new IllegalStateException("Chapter creation reservation was lost"));
    if (!fingerprint.equals(reservation.requestFingerprint())) {
      throw new ResourceConflictException(
          "Idempotency-Key is already bound to a different request");
    }
    if (reservation.chapterId() != null) {
      ChapterResponse existing =
          chapterRepository
              .findById(reservation.chapterId())
              .map(ChapterResponse::from)
              .orElseThrow(() -> new ResourceNotFoundException("Idempotent chapter not found"));
      return ApiResponse.success("Chapter already created", existing);
    }

    StoryVersion storyVersion = resolveStoryVersion(command, project);
    int orderIndex =
        command.orderIndex() != null
            ? command.orderIndex()
            : chapterRepository.findMaxOrderIndexByStoryVersionId(storyVersion.getId()) + 1;
    if (orderIndex < 0) throw new IllegalArgumentException("orderIndex must not be negative");

    ApiResponse<ChapterResponse> response =
        createChapterUseCase.execute(
            new CreateChapterCommand(
                command.projectId(),
                storyVersion.getId(),
                orderIndex,
                command.title(),
                command.sourceText()));
    idempotencyRepository.complete(reservation.id(), response.data().id());
    return response;
  }

  private StoryVersion resolveStoryVersion(CreateChapterWithStoryCommand command, Project project) {
    if (command.storyVersionId() != null) {
      return storyVersionRepository
          .findByIdAndProjectId(command.storyVersionId(), command.projectId())
          .orElseThrow(() -> new ResourceNotFoundException("Story version not found"));
    }
    return storyVersionRepository
        .findActiveByProjectId(command.projectId())
        .or(() -> storyVersionRepository.findLatestByProjectId(command.projectId()))
        .orElseGet(
            () ->
                createStoryVersionUseCase.execute(
                    new CreateStoryVersionCommand(
                        command.projectId(),
                        command.sourceText(),
                        project.getSourceLanguage(),
                        null)));
  }

  private static void requireIdempotencyKey(String value) {
    if (value == null || value.isBlank() || value.length() > 200) {
      throw new IllegalArgumentException(
          "Idempotency-Key must be present and at most 200 characters");
    }
  }

  private static String fingerprint(CreateChapterWithStoryCommand command) {
    String value =
        String.join(
            "\u001f",
            String.valueOf(command.projectId()),
            String.valueOf(command.storyVersionId()),
            String.valueOf(command.orderIndex()),
            command.title() == null ? "" : command.title().trim(),
            command.sourceText() == null ? "" : command.sourceText().trim());
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder(digest.length * 2);
      for (byte item : digest) hex.append(String.format("%02x", item));
      return hex.toString();
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }
}
