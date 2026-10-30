import { useState } from "react";
import type { FormEvent } from "react";
import type { BlocksUser } from "@seliseblocks/client";
import { errorMessage, errorStatus } from "../../lib/blocks/errors";
import { APP_ROLES, roleLabel } from "../../lib/permissions";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Alert } from "../../shared/ui/Alert";
import { FormField, SelectField } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { sendNotification } from "../notifications/notifications";
import type { Organization } from "../organizations/useOrganizations";
import { useCurrentUser, userDisplayName } from "../profile/useCurrentUser";
import { useChangeRole, useInviteUser, userRoles, useSetUserActive } from "./users";

function useFailureText() {
  const { t } = useT();
  return (caught: unknown) => (errorStatus(caught) === 403 ? t("users.error.forbidden") : errorMessage(caught, t("common.error")));
}

export function InviteUserModal({ onClose, onInvited, organization }: { onClose: () => void; onInvited: (email: string) => void; organization: Organization }) {
  const { t } = useT();
  const invite = useInviteUser();
  const failureText = useFailureText();
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", role: APP_ROLES[1].slug as string });
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (invite.isPending) return;
    setError(undefined);
    try {
      const email = form.email.trim();
      await invite.mutateAsync({ email, firstName: form.firstName.trim(), lastName: form.lastName.trim(), organizationId: organization.id, role: form.role });
      onInvited(email);
    } catch (caught) {
      setError(failureText(caught));
    }
  }

  return (
    <Modal title={`${t("users.inviteTitle")} ${organization.name}`} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="form-row">
          <FormField label={t("field.firstName")} required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          <FormField label={t("field.lastName")} required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </div>
        <FormField label={t("field.email")} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <SelectField label={t("field.role")} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {APP_ROLES.map((role) => <option key={role.slug} value={role.slug}>{role.label}</option>)}
        </SelectField>
        <div className="modal-actions">
          <button type="button" className="icon-button" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="primary-button" disabled={invite.isPending}>{invite.isPending ? t("common.working") : t("users.sendInvite")}</button>
        </div>
      </form>
    </Modal>
  );
}

export function ChangeRoleModal({
  onClose,
  onDone,
  organization,
  user
}: { onClose: () => void; onDone: (text: string, tone: "info" | "warn") => void; organization: Organization; user: BlocksUser }) {
  const { t } = useT();
  const me = useCurrentUser();
  const changeRole = useChangeRole();
  const failureText = useFailureText();
  const [role, setRole] = useState(userRoles(user)[0] ?? APP_ROLES[1].slug);
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (changeRole.isPending) return;
    setError(undefined);
    const userId = user.itemId as string;
    try {
      await changeRole.mutateAsync({ organizationId: organization.id, role, userId });
    } catch (caught) {
      setError(failureText(caught));
      return;
    }
    // The access change already succeeded; the notification is best-effort.
    try {
      await sendNotification([userId], {
        body: `Your role in ${organization.name} changed to ${roleLabel(role)}.`,
        orgId: organization.id,
        sentBy: userDisplayName(me.data?.data) || "Admin",
        title: "Your role was updated"
      });
      onDone(`${userDisplayName(user)}: ${roleLabel(role)}`, "info");
    } catch {
      onDone(`${userDisplayName(user)}: ${roleLabel(role)}. ${t("users.notifyFailed")}`, "warn");
    }
  }

  return (
    <Modal title={`${t("users.changeRole")}: ${userDisplayName(user)}`} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <SelectField label={t("field.role")} value={role} onChange={(e) => setRole(e.target.value)}>
          {APP_ROLES.map((entry) => <option key={entry.slug} value={entry.slug}>{entry.label}</option>)}
        </SelectField>
        <div className="modal-actions">
          <button type="button" className="icon-button" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="primary-button" disabled={changeRole.isPending}>{changeRole.isPending ? t("common.working") : t("common.save")}</button>
        </div>
      </form>
    </Modal>
  );
}

export function ReactivateModal({ onClose, onDone, user }: { onClose: () => void; onDone: (text: string) => void; user: BlocksUser }) {
  const { t } = useT();
  const setActive = useSetUserActive();
  const failureText = useFailureText();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (setActive.isPending) return;
    setError(undefined);
    try {
      await setActive.mutateAsync({ active: true, reason, userId: user.itemId as string });
      onDone(`${userDisplayName(user)} ${t("users.reactivated")}`);
    } catch (caught) {
      setError(failureText(caught));
    }
  }

  return (
    <Modal title={`${t("users.reactivate")}: ${userDisplayName(user)}`} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <FormField label={t("users.reason")} required value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="modal-actions">
          <button type="button" className="icon-button" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="primary-button" disabled={setActive.isPending || !reason.trim()}>{setActive.isPending ? t("common.working") : t("users.reactivate")}</button>
        </div>
      </form>
    </Modal>
  );
}
