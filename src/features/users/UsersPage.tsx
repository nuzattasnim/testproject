import { Search, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import type { BlocksUser } from "@seliseblocks/client";
import { errorMessage, errorStatus } from "../../lib/blocks/errors";
import { hasPermission, PERMISSIONS, roleLabel } from "../../lib/permissions";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import { DataTable } from "../../shared/ui/DataTable";
import type { Column } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { Forbidden } from "../auth/Forbidden";
import { isUserActive } from "../notifications/notifications";
import { useActiveOrganization } from "../organizations/useOrganizations";
import { useCurrentUser, userDisplayName } from "../profile/useCurrentUser";
import { ChangeRoleModal, InviteUserModal, ReactivateModal } from "./UserModals";
import { userRoles, USERS_PAGE_SIZE, useOrgUsers, useSetUserActive } from "./users";

type Dialog =
  | { kind: "invite" }
  | { kind: "role"; user: BlocksUser }
  | { kind: "deactivate"; user: BlocksUser }
  | { kind: "reactivate"; user: BlocksUser };

export function UsersPage() {
  const { t } = useT();
  const me = useCurrentUser();
  const profile = me.data?.data;
  const canRead = hasPermission(profile, PERMISSIONS.usersRead);
  const canManage = hasPermission(profile, PERMISSIONS.usersManage);
  const { isLoading: orgLoading, organization } = useActiveOrganization();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Dialog | undefined>();
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "info" | "warn" } | undefined>();
  // The permission check runs before any users call is made (C4).
  const users = useOrgUsers(organization?.id, page, search, canRead);
  const setActive = useSetUserActive();

  if (me.isLoading || orgLoading) {
    return <section><Skeleton className="skeleton-line-lg" /><Skeleton className="skeleton-line" /></section>;
  }
  if (!canRead) return <Forbidden />;

  const rows = users.data?.users ?? [];
  const total = users.data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));

  function actionFailed(caught: unknown) {
    const status = errorStatus(caught);
    setNotice({
      text: status === 403 ? t("users.error.forbidden") : errorMessage(caught, t("common.error")),
      tone: "error"
    });
  }

  async function confirmDeactivate(user: BlocksUser) {
    try {
      await setActive.mutateAsync({ active: false, userId: user.itemId as string });
      setNotice({ text: `${userDisplayName(user)} ${t("users.deactivated")}`, tone: "info" });
    } catch (caught) {
      actionFailed(caught);
    } finally {
      setDialog(undefined);
    }
  }

  const columns: Column<BlocksUser>[] = [
    { header: t("field.name"), key: "name", render: (user) => <strong>{userDisplayName(user) || "—"}</strong> },
    { header: t("field.email"), key: "email", render: (user) => user.email ?? "—" },
    {
      header: t("field.role"),
      key: "roles",
      render: (user) => (
        <div className="chips">
          {userRoles(user).length === 0 ? <span className="muted">—</span> : userRoles(user).map((role) => <span key={role} className="chip">{roleLabel(role)}</span>)}
        </div>
      )
    },
    {
      header: t("field.status"),
      key: "status",
      render: (user) => isUserActive(user)
        ? <StatusPill tone="good">{t("users.active")}</StatusPill>
        : <StatusPill tone="warn">{t("users.inactive")}</StatusPill>
    }
  ];

  if (canManage) {
    columns.push({
      header: <span className="sr-only">{t("users.actions")}</span>,
      key: "actions",
      render: (user) => {
        // An admin may not demote or deactivate themself (C12).
        const isSelf = Boolean(user.itemId) && user.itemId === profile?.itemId;
        const selfTitle = isSelf ? t("users.selfLocked") : undefined;
        return (
          <div className="row-actions">
            <button className="link-button" disabled={isSelf} title={selfTitle} onClick={() => setDialog({ kind: "role", user })}>{t("users.changeRole")}</button>
            {isUserActive(user) ? (
              <button className="link-button danger" disabled={isSelf} title={selfTitle} onClick={() => setDialog({ kind: "deactivate", user })}>{t("users.deactivate")}</button>
            ) : (
              <button className="link-button" onClick={() => setDialog({ kind: "reactivate", user })}>{t("users.reactivate")}</button>
            )}
          </div>
        );
      }
    });
  }

  return (
    <section>
      <PageHeader
        title={t("users.title")}
        subtitle={organization ? `${t("users.subtitle")} ${organization.name}` : t("users.subtitle")}
        actions={canManage && organization ? (
          <ActionButton onClick={() => setDialog({ kind: "invite" })} icon={<UserPlus size={18} />}>{t("users.invite")}</ActionButton>
        ) : undefined}
      />

      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

      <form
        className="search-box users-search"
        role="search"
        onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}
      >
        <Search size={16} />
        <input aria-label={t("users.search")} placeholder={t("users.search")} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
      </form>

      {!organization ? (
        <EmptyState icon={<Users size={22} />} title={t("users.noOrgTitle")} description={t("users.noOrg")} />
      ) : users.isLoading ? (
        <div className="panel"><Skeleton className="skeleton-line-lg" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line" /></div>
      ) : users.isError ? (
        <ErrorState message={errorStatus(users.error) === 403 ? t("users.error.forbidden") : t("users.loadFailed")} onRetry={() => users.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title={t("users.emptyTitle")} description={search ? t("users.noMatches") : t("users.empty")} />
      ) : (
        <DataTable columns={columns} rows={rows} />
      )}

      {lastPage > 1 ? (
        <div className="pager">
          <button className="icon-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t("common.previous")}</button>
          <span>{page} / {lastPage}</span>
          <button className="icon-button" disabled={page >= lastPage} onClick={() => setPage((value) => value + 1)}>{t("common.next")}</button>
        </div>
      ) : null}

      {dialog?.kind === "invite" && organization ? (
        <InviteUserModal
          organization={organization}
          onClose={() => setDialog(undefined)}
          onInvited={(email) => { setDialog(undefined); setNotice({ text: `${t("users.invited")} ${email}`, tone: "info" }); }}
        />
      ) : null}
      {dialog?.kind === "role" && organization ? (
        <ChangeRoleModal
          organization={organization}
          user={dialog.user}
          onClose={() => setDialog(undefined)}
          onDone={(text, tone) => { setDialog(undefined); setNotice({ text, tone }); }}
        />
      ) : null}
      {dialog?.kind === "reactivate" ? (
        <ReactivateModal
          user={dialog.user}
          onClose={() => setDialog(undefined)}
          onDone={(text) => { setDialog(undefined); setNotice({ text, tone: "info" }); }}
        />
      ) : null}
      {dialog?.kind === "deactivate" ? (
        <ConfirmDialog
          title={t("users.deactivateTitle")}
          message={`${userDisplayName(dialog.user)} ${t("users.deactivateMessage")}`}
          confirmLabel={t("users.deactivate")}
          pending={setActive.isPending}
          onCancel={() => setDialog(undefined)}
          onConfirm={() => void confirmDeactivate(dialog.user)}
        />
      ) : null}
    </section>
  );
}
