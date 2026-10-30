import { BlocksApiError } from "@seliseblocks/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { blocksClient } from "./mockClient";

vi.mock("../src/lib/blocks/client", async () => ({ blocksClient: (await import("./mockClient")).blocksClient }));

const {
  classifySendError,
  MAX_BACKOFF_MS,
  NOTIFICATION_CONFIGURATION,
  parseInbox,
  parseNotification,
  pollInterval,
  POLL_INTERVAL_MS,
  resolveRecipients,
  sendNotification
} = await import("../src/features/notifications/notifications");

beforeEach(() => vi.clearAllMocks());

describe("parseNotification", () => {
  it("reads a JSON-string payload", () => {
    const item = parseNotification({ denormalizedPayload: JSON.stringify({ body: "b", orgId: "o1", title: "T" }), id: "n1", isRead: false });
    expect(item).toEqual({ body: "b", createdTime: undefined, id: "n1", isRead: false, orgId: "o1", sentBy: undefined, title: "T" });
  });

  it("reads an object payload and falls back to a default title", () => {
    expect(parseNotification({ id: "n2", payload: { body: "x" } })?.title).toBe("Notification");
  });

  it("drops items without an id", () => {
    expect(parseNotification({ denormalizedPayload: "{}" })).toBeUndefined();
  });
});

describe("org isolation (C7)", () => {
  it("hides notifications stamped with another organization", () => {
    const inbox = parseInbox({
      notifications: [
        { denormalizedPayload: JSON.stringify({ orgId: "alpha", title: "A" }), id: "1" },
        { denormalizedPayload: JSON.stringify({ orgId: "beta", title: "B" }), id: "2" },
        { denormalizedPayload: JSON.stringify({ title: "unstamped" }), id: "3" }
      ],
      totalNotificationsCount: 3,
      unReadNotificationsCount: 3
    }, "alpha");
    expect(inbox.items.map((item) => item.id)).toEqual(["1", "3"]);
  });
});

describe("polling backoff (H10, C8)", () => {
  it("polls every 30 s while healthy and backs off up to 5 minutes", () => {
    expect(pollInterval(0)).toBe(POLL_INTERVAL_MS);
    expect(pollInterval(1)).toBe(60_000);
    expect(pollInterval(2)).toBe(120_000);
    expect(pollInterval(10)).toBe(MAX_BACKOFF_MS);
  });
});

describe("resolveRecipients", () => {
  it("returns the single user for a user target without listing", async () => {
    expect(await resolveRecipients("alpha", { kind: "user", userId: "u1" })).toEqual(["u1"]);
    expect(blocksClient.iam.users.list).not.toHaveBeenCalled();
  });

  it("scopes a role target to the active org and skips inactive users", async () => {
    blocksClient.iam.users.list.mockResolvedValue({ data: [{ active: true, itemId: "u1" }, { active: false, itemId: "u2" }, { itemId: "u3" }] });
    expect(await resolveRecipients("alpha", { kind: "role", role: "member" })).toEqual(["u1", "u3"]);
    expect(blocksClient.iam.users.list).toHaveBeenCalledWith({ filter: { organizationIds: ["alpha"], roles: ["member"] }, pageNo: 1, pageSize: 100 });
  });
});

describe("sendNotification (H9, C16)", () => {
  it("sends once to explicit userIds through the notifs configuration", async () => {
    blocksClient.notifier.notify.mockResolvedValue({});
    await sendNotification(["u1", "u2"], { body: "Body", orgId: "alpha", sentBy: "Admin", title: "Hi" });
    expect(blocksClient.notifier.notify).toHaveBeenCalledTimes(1);
    const request = blocksClient.notifier.notify.mock.calls[0]?.[0];
    expect(request.configurationName).toBe(NOTIFICATION_CONFIGURATION);
    expect(request.userIds).toEqual(["u1", "u2"]);
    expect(request.roles).toBeUndefined();
    expect(JSON.parse(request.denormalizedPayload)).toEqual({ body: "Body", orgId: "alpha", sentBy: "Admin", title: "Hi" });
  });

  it("makes no call when there are no recipients", async () => {
    await expect(sendNotification([], { body: "b", orgId: "o", sentBy: "s", title: "t" })).rejects.toThrow("No recipients");
    expect(blocksClient.notifier.notify).not.toHaveBeenCalled();
  });

  it("truncates title and body to their limits", async () => {
    blocksClient.notifier.notify.mockResolvedValue({});
    await sendNotification(["u1"], { body: "b".repeat(600), orgId: "o", sentBy: "s", title: "t".repeat(100) });
    const payload = JSON.parse(blocksClient.notifier.notify.mock.calls[0]?.[0].denormalizedPayload);
    expect(payload.title).toHaveLength(80);
    expect(payload.body).toHaveLength(500);
  });
});

describe("classifySendError (C11, C16)", () => {
  it("maps notifier failures to user-facing categories", () => {
    expect(classifySendError(new BlocksApiError(400, "Bad Request", { errors: { ConfigurationName: ["not found"] } }))).toBe("config");
    expect(classifySendError(new BlocksApiError(401, "Unauthorized", {}))).toBe("forbidden");
    expect(classifySendError(new BlocksApiError(429, "Too Many Requests", {}))).toBe("rateLimited");
    expect(classifySendError(new Error("boom"))).toBe("unknown");
  });
});
