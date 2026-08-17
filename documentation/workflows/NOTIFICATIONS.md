# Notification and outbox workflow

Notifications are durable product state. Email and future Web Push are delivery channels, not the source of truth.

## Flow

```text
Render/Short job terminal transition
  -> same transaction writes unique OutboxEvent(event_key)
  -> dispatcher claims pending event
  -> persist in-app Notification for current user
  -> enqueue email only when preference enables it
  -> retry channel delivery with backoff
  -> mark channel state without changing render/job status
```

## Rules

- `event_key` is unique and derived from the durable aggregate terminal transition. Replays and worker restarts cannot create duplicate in-app notifications.
- In-app notification is persisted before optional email dispatch. The user can see completion/failure after reopening the application and does not need to keep a tab or poll.
- Notification records are ownership-scoped by `user_id`; deep links must re-check project/job authorization on the backend.
- Email failure is retryable and best-effort. It never rolls back a completed render and never creates a second notification event.
- Localized title/message use stable message keys. Locale resolution occurs at presentation/delivery time; business state stores codes, not hard-coded Vietnamese labels.

## Reliability targets

- Persist the in-app notification within 30 seconds of the terminal job commit.
- Enqueue optional email within two minutes; delivery itself may be retried.
- Monitor pending outbox age, notification lag, duplicate-key conflicts and channel failure rate.

## Current foundation status

`V3__v17_control_plane.sql` provides `outbox_events`, `notifications` and `notification_preferences`. The dispatcher, email adapter and exact-once integration tests remain target work.
