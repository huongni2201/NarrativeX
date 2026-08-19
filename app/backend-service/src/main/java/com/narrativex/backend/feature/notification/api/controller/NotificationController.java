package com.narrativex.backend.feature.notification.api.controller;

import com.narrativex.backend.feature.common.response.ApiResponse;
import com.narrativex.backend.feature.notification.api.response.NotificationResponse;
import com.narrativex.backend.feature.notification.application.usecase.NotificationUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/notifications")
public class NotificationController {
  private final NotificationUseCase notificationUseCase;

  @GetMapping
  public ResponseEntity<ApiResponse<NotificationResponse.Feed>> list(
      @RequestParam(defaultValue = "20") int limit,
      @RequestParam(defaultValue = "false") boolean unreadOnly) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Notifications retrieved successfully",
            NotificationResponse.Feed.from(notificationUseCase.list(unreadOnly, limit))));
  }

  @PatchMapping("/{notificationId}/read")
  public ResponseEntity<ApiResponse<NotificationResponse>> markRead(
      @PathVariable Long notificationId) {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Notification marked as read",
            NotificationResponse.from(notificationUseCase.markRead(notificationId))));
  }

  @PostMapping("/read-all")
  public ResponseEntity<ApiResponse<NotificationResponse.MarkAllRead>> markAllRead() {
    return ResponseEntity.ok(
        ApiResponse.success(
            "Notifications marked as read",
            new NotificationResponse.MarkAllRead(notificationUseCase.markAllRead())));
  }
}
