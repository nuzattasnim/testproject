import { Bell, CheckCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "../../shared/ui/dropdown-menu";
import { useActiveOrganization } from "../../features/organizations/useOrganizations";
import { useMarkRead, useUnreadNotifications } from "../../features/notifications/notifications";
import { useT } from "../../lib/i18n/LocalizationProvider";

const PREVIEW_COUNT = 5;

export function NotificationsMenu({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useT();
  const { organization } = useActiveOrganization();
  const unread = useUnreadNotifications(organization?.id);
  const markRead = useMarkRead();
  const items = unread.data?.items ?? [];
  const count = items.length;
  const label = count > 0 ? `${t("nav.notifications")}: ${count} ${t("notifications.unread")}` : t("nav.notifications");

  return (
    <>
      {/* Announced politely whenever the unread count changes. */}
      <span className="sr-only" aria-live="polite">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger className="icon-button notification-trigger" aria-label={label}>
          <Bell size={18} />
          {count > 0 ? <span className="notification-badge" aria-hidden="true">{count > 49 ? "49+" : count}</span> : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[320px]">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>{t("nav.notifications")}</span>
            {count > 0 ? (
              <button className="link-button" disabled={markRead.isPending} onClick={() => markRead.mutate("all")}>
                {t("notifications.markAllRead")}
              </button>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {count === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <CheckCheck size={22} className="text-[hsl(var(--muted-foreground))]" />
              <p className="text-sm font-medium">{t("notifications.caughtUp")}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">{t("notifications.noneNew")}</p>
            </div>
          ) : (
            items.slice(0, PREVIEW_COUNT).map((item) => (
              <DropdownMenuItem key={item.id} className="notification-preview" onSelect={() => markRead.mutate(item.id)}>
                <strong>{item.title}</strong>
                {item.body ? <span>{item.body}</span> : null}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onNavigate("/notifications")}>{t("notifications.viewAll")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
