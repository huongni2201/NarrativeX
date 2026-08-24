export interface NotificationItem {
  id: number;
  projectId: string | null;
  type: string;
  titleKey: string;
  messageKey: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationFeed {
  unreadCount: number;
  items: NotificationItem[];
}

export interface MarkAllReadResult {
  updatedCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

export function isNotificationItem(value: unknown): value is NotificationItem {
  return (
    isRecord(value) &&
    isNumber(value.id) &&
    isNullableString(value.projectId) &&
    isString(value.type) &&
    isString(value.titleKey) &&
    isString(value.messageKey) &&
    isNullableString(value.readAt) &&
    isString(value.createdAt)
  );
}

export function isNotificationFeed(value: unknown): value is NotificationFeed {
  return (
    isRecord(value) &&
    isNumber(value.unreadCount) &&
    Array.isArray(value.items) &&
    value.items.every(isNotificationItem)
  );
}

export function isMarkAllReadResult(value: unknown): value is MarkAllReadResult {
  return isRecord(value) && isNumber(value.updatedCount);
}
