package com.narrativex.backend.feature.storyboard.application.usecase;

import com.narrativex.backend.feature.auth.application.port.in.CurrentUserId;
import com.narrativex.backend.feature.common.exception.ResourceConflictException;
import com.narrativex.backend.feature.common.exception.ResourceNotFoundException;
import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.project.application.port.in.StoryVersionAccess;
import com.narrativex.backend.feature.storyboard.api.response.ChapterResponse;
import com.narrativex.backend.feature.storyboard.application.command.CreateChapterCommand;
import com.narrativex.backend.feature.storyboard.application.command.CreateChapterWithStoryCommand;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterCreationIdempotencyRepository;
import com.narrativex.backend.feature.storyboard.application.port.out.ChapterRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Application orchestrator for the chapter/story creation workflow. */
@Service
@RequiredArgsConstructor
public class CreateChapterWithStoryUseCase {
  private final CurrentUserId currentUserId;
  private final StoryVersionAccess storyVersionAccess;
  private final CreateChapterUseCase createChapterUseCase;
  private final ChapterRepository chapterRepository;
  private final ChapterCreationIdempotencyRepository idempotencyRepository;

  @Transactional
  public ApiResponse<ChapterResponse> execute(CreateChapterWithStoryCommand command) {
    requireIdempotencyKey(command.idempotencyKey());
    String ownerId = currentUserId.get();
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

    UUID storyVersionId = resolveStoryVersionId(command, ownerId);
    int orderIndex =
        command.orderIndex() != null
            ? command.orderIndex()
            : chapterRepository.findMaxOrderIndexByStoryVersionId(storyVersionId) + 1;
    if (orderIndex < 0) throw new IllegalArgumentException("orderIndex must not be negative");

    ApiResponse<ChapterResponse> response =
        createChapterUseCase.execute(
            new CreateChapterCommand(
                command.projectId(),
                storyVersionId,
                orderIndex,
                command.title(),
                command.sourceText()));
    idempotencyRepository.complete(reservation.id(), response.data().id());
    return response;
  }

  private UUID resolveStoryVersionId(CreateChapterWithStoryCommand command, String ownerId) {
    if (command.storyVersionId() != null) {
      storyVersionAccess.requireOwnedStoryVersion(
          command.projectId(), command.storyVersionId(), ownerId);
      return command.storyVersionId();
    }
    return storyVersionAccess.resolveOrCreateStoryVersion(
        command.projectId(), ownerId, command.sourceText());
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
