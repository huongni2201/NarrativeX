import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi, type ListNotificationsParams } from "../api/notifications.api";
import { useAuthStore } from "@/store/useAuthStore";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

export function useNotifications(params: ListNotificationsParams = {}) {
  const status = useAuthStore((state) => state.status);
  const isAuthenticated = status === "authenticated";

  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, params],
    queryFn: () => notificationsApi.list(params),
    enabled: isAuthenticated,
    refetchInterval: 15000, // Poll every 15 seconds for new notifications
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: number) => notificationsApi.markRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}
