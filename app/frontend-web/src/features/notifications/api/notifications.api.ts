import { apiRequest } from "@/shared/api/client";
import {
  type NotificationFeed,
  type NotificationItem,
  type MarkAllReadResult,
  isNotificationFeed,
  isNotificationItem,
  isMarkAllReadResult,
} from "../types/notifications.types";

export interface ListNotificationsParams {
  limit?: number;
  unreadOnly?: boolean;
}

export const notificationsApi = {
  list: (params: ListNotificationsParams = {}) => {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.unreadOnly !== undefined) searchParams.set("unreadOnly", String(params.unreadOnly));

    const query = searchParams.toString();
    const endpoint = `/api/v1/notifications${query ? `?${query}` : ""}`;

    return apiRequest<NotificationFeed>(endpoint, {}, isNotificationFeed);
  },

  markRead: (notificationId: number) =>
    apiRequest<NotificationItem>(
      `/api/v1/notifications/${notificationId}/read`,
      { method: "PATCH" },
      isNotificationItem,
    ),

  markAllRead: () =>
    apiRequest<MarkAllReadResult>(
      "/api/v1/notifications/read-all",
      { method: "POST" },
      isMarkAllReadResult,
    ),
};
