import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlocksGetNotificationsResponse, BlocksUser } from "@seliseblocks/client";
import { useAuth } from "../../app/providers/AuthProvider";
import { blocksClient } from "../../lib/blocks/client";
import { ensureSuccess, errorStatus } from "../../lib/blocks/errors";

// The project's notification configuration (blocks notification list).
// Its audience admits role `clouduser` plus explicitly named users, so every
// send targets explicit userIds resolved inside the active organization.
export const NOTIFICATION_CONFIGURATION = "notifs";
export const POLL_INTERVAL_MS = 30_000;
export const MAX_BACKOFF_MS = 5 * 60_000;
export const TITLE_MAX = 80;
export const BODY_MAX = 500;
const POLL_PAGE_SIZE = 50;

export type AppNotification = {
  body: string;
  createdTime?: string;
  id: string;
  isRead: boolean;
  orgId?: string;
  sentBy?: string;
  title: string;
};

export type NotificationPayload = { body: string; orgId: string; sentBy: string; title: string };

function readPayload(raw: Record<string, unknown>): Partial<NotificationPayload> {
  const source = raw.denormalizedPayload ?? raw.payload;
  if (source && typeof source === "object") return source as Partial<NotificationPayload>;
  if (typeof source === "string") {
    try {
      const parsed = JSON.parse(source) as unknown;
      if (parsed && typeof parsed === "object") return parsed as Partial<NotificationPayload>;
    } catch {
      return { body: source };
    }
  }
  return {};
}

export function parseNotification(raw: Record<string, unknown>): AppNotification | undefined {
  const id = (raw.id ?? raw.itemId) as string | undefined;
  if (!id) return undefined;
  const payload = readPayload(raw);
  return {
    body: String(payload.body ?? ""),
    createdTime: (raw.createdTime ?? raw.createDate) as string | undefined,
    id,
    isRead: Boolean(raw.isRead),
    orgId: payload.orgId,
    sentBy: payload.sentBy,
    title: String(payload.title ?? "Notification")
  };
}

// The inbox is per user, not per org; a notification stamped with another
// organization must never show while this one is active. Unstamped ones
// (sent from outside this app) are shown everywhere.
export function visibleInOrg(notification: AppNotification, orgId: string | undefined): boolean {
  return !notification.orgId || !orgId || notification.orgId === orgId;
}

export function parseInbox(response: BlocksGetNotificationsResponse, orgId: string | undefined) {
  const items = (response.notifications ?? [])
    .map(parseNotification)
    .filter((item): item is AppNotification => Boolean(item))
    .filter((item) => visibleInOrg(item, orgId));
  return { items, total: response.totalNotificationsCount ?? items.length };
}

// Exponential backoff after failures, capped; 30 s while healthy.
export function pollInterval(failureCount: number): number {
  if (failureCount <= 0) return POLL_INTERVAL_MS;
  return Math.min(POLL_INTERVAL_MS * 2 ** failureCount, MAX_BACKOFF_MS);
}

// Unread badge source. react-query pauses refetchInterval while the tab is
// hidden (refetchIntervalInBackground: false) and refetches as soon as it
// becomes visible again (refetchOnWindowFocus) -- zero polls while hidden.
// On failure the previous data stays in cache, so the count never flickers.
export function useUnreadNotifications(orgId: string | undefined) {
  const { status } = useAuth();
  return useQuery({
    enabled: status === "authenticated",
    queryFn: async () => parseInbox(
      await blocksClient.notifier.getNotifications({ isUnreadOnly: true, page: 0, pageSize: POLL_PAGE_SIZE }),
      orgId
    ),
    queryKey: ["notifier", "unread", orgId],
    refetchInterval: (query) => pollInterval(query.state.fetchFailureCount),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  });
}

// `page` is the UI's 1-based page; the notifier pages from 0.
export function useInbox(orgId: string | undefined, page: number, unreadOnly: boolean, pageSize = 20) {
  const { status } = useAuth();
  return useQuery({
    enabled: status === "authenticated",
    queryFn: async () => parseInbox(
      await blocksClient.notifier.getNotifications({ isUnreadOnly: unreadOnly, page: page - 1, pageSize, sortBy: "createdTime", sortDescending: true }),
      orgId
    ),
    placeholderData: (previous) => previous,
    queryKey: ["notifier", "inbox", orgId, page, unreadOnly, pageSize]
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string | "all") => {
      if (id === "all") return blocksClient.notifier.markAllNotificationAsRead();
      return blocksClient.notifier.markNotificationAsRead({ id });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifier"] })
  });
}

export type RecipientTarget =
  | { kind: "org" }
  | { kind: "role"; role: string }
  | { kind: "user"; userId: string };

export function isUserActive(user: BlocksUser): boolean {
  const record = user as Record<string, unknown>;
  const flag = record.active ?? record.isActive;
  return flag === undefined ? true : Boolean(flag);
}

// Resolve a target to explicit, active user ids inside one organization.
// Test scale is small (<= 20 users per org), so one page of 100 covers it.
export async function resolveRecipients(orgId: string, target: RecipientTarget): Promise<string[]> {
  if (target.kind === "user") return [target.userId];
  const filter: Record<string, unknown> = { organizationIds: [orgId] };
  if (target.kind === "role") filter.roles = [target.role];
  const response = ensureSuccess(await blocksClient.iam.users.list({ filter, pageNo: 1, pageSize: 100 }));
  return (response.data ?? [])
    .filter(isUserActive)
    .map((user) => user.itemId)
    .filter((id): id is string => Boolean(id));
}

export class NoRecipientsError extends Error {}

export async function sendNotification(userIds: string[], payload: NotificationPayload) {
  if (userIds.length === 0) throw new NoRecipientsError("No recipients");
  return ensureSuccess(await blocksClient.notifier.notify({
    configurationName: NOTIFICATION_CONFIGURATION,
    denormalizedPayload: JSON.stringify({
      body: payload.body.slice(0, BODY_MAX),
      orgId: payload.orgId,
      sentBy: payload.sentBy,
      title: payload.title.slice(0, TITLE_MAX)
    }),
    saveDenormalizedPayloadAsAnObject: true,
    userIds
  }));
}

export type SendFailure = "config" | "forbidden" | "noRecipients" | "rateLimited" | "unknown";

export function classifySendError(error: unknown): SendFailure {
  if (error instanceof NoRecipientsError) return "noRecipients";
  const status = errorStatus(error);
  if (status === 429) return "rateLimited";
  if (status === 401 || status === 403) return "forbidden";
  if (status === 400) {
    const body = JSON.stringify((error as { body?: unknown }).body ?? "");
    if (/ConfigurationName/i.test(body)) return "config";
    if (/rate|limit/i.test(body)) return "rateLimited";
  }
  return "unknown";
}
