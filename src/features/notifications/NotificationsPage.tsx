import { Bell, CheckCheck, RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import { hasPermission, PERMISSIONS } from "../../lib/permissions";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { useActiveOrganization } from "../organizations/useOrganizations";
import { useCurrentUser } from "../profile/useCurrentUser";
import { useInbox, useMarkRead } from "./notifications";
import { SendNotificationModal } from "./SendNotificationModal";

const PAGE_SIZE = 20;

export function NotificationsPage() {
  const { t } = useT();
  const me = useCurrentUser();
  const { organization } = useActiveOrganization();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [composing, setComposing] = useState(false);
  const inbox = useInbox(organization?.id, page, unreadOnly, PAGE_SIZE);
  const markRead = useMarkRead();
  const canSend = hasPermission(me.data?.data, PERMISSIONS.notificationsSend);
  const items = inbox.data?.items ?? [];
  const total = inbox.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function showFilter(next: boolean) {
    setUnreadOnly(next);
    setPage(1);
  }

  return (
    <section>
      <PageHeader
        title={t("notifications.title")}
        subtitle={organization ? `${t("notifications.subtitle")} ${organization.name}` : t("notifications.subtitle")}
        actions={
          <div className="header-actions">
            <ActionButton variant="icon" onClick={() => inbox.refetch()} title={t("common.refresh")} aria-label={t("common.refresh")} icon={<RefreshCw size={18} />} />
            <ActionButton variant="icon" disabled={markRead.isPending || items.every((item) => item.isRead)} onClick={() => markRead.mutate("all")} icon={<CheckCheck size={18} />}>
              {t("notifications.markAllRead")}
            </ActionButton>
            {canSend && organization ? (
              <ActionButton onClick={() => setComposing(true)} icon={<Send size={18} />}>{t("notifications.send")}</ActionButton>
            ) : null}
          </div>
        }
      />

      <div className="segmented" role="group" aria-label={t("notifications.filter")}>
        <button className={!unreadOnly ? "active" : ""} aria-pressed={!unreadOnly} onClick={() => showFilter(false)}>{t("notifications.all")}</button>
        <button className={unreadOnly ? "active" : ""} aria-pressed={unreadOnly} onClick={() => showFilter(true)}>{t("notifications.unreadOnly")}</button>
      </div>

      {inbox.isLoading ? (
        <div className="panel"><Skeleton className="skeleton-line-lg" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line" /></div>
      ) : inbox.isError ? (
        <ErrorState message={t("notifications.loadFailed")} onRetry={() => inbox.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Bell size={22} />} title={t("notifications.caughtUp")} description={unreadOnly ? t("notifications.noneUnread") : t("notifications.none")} />
      ) : (
        <ul className="notification-list">
          {items.map((item) => (
            <li key={item.id} className={item.isRead ? "read" : "unread"}>
              <div className="notification-text">
                <strong>{item.title}</strong>
                {item.body ? <p>{item.body}</p> : null}
                <small className="muted">
                  {item.createdTime ? new Date(item.createdTime).toLocaleString() : ""}
                  {item.sentBy ? ` · ${item.sentBy}` : ""}
                </small>
              </div>
              {item.isRead ? (
                <StatusPill tone="neutral">{t("notifications.read")}</StatusPill>
              ) : (
                <button className="link-button" disabled={markRead.isPending} onClick={() => markRead.mutate(item.id)}>{t("notifications.markRead")}</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {lastPage > 1 ? (
        <div className="pager">
          <button className="icon-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t("common.previous")}</button>
          <span>{page} / {lastPage}</span>
          <button className="icon-button" disabled={page >= lastPage} onClick={() => setPage((value) => value + 1)}>{t("common.next")}</button>
        </div>
      ) : null}

      {composing && organization ? <SendNotificationModal organization={organization} onClose={() => setComposing(false)} /> : null}
    </section>
  );
}
