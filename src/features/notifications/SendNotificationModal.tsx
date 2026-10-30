import { useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { blocksClient } from "../../lib/blocks/client";
import { ensureSuccess } from "../../lib/blocks/errors";
import { APP_ROLES } from "../../lib/permissions";
import { useT } from "../../lib/i18n/LocalizationProvider";
import type { TranslationKey } from "../../lib/i18n/dictionary";
import { Alert } from "../../shared/ui/Alert";
import { FormField, SelectField, TextAreaField } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import type { Organization } from "../organizations/useOrganizations";
import { useCurrentUser, userDisplayName } from "../profile/useCurrentUser";
import {
  BODY_MAX,
  classifySendError,
  isUserActive,
  resolveRecipients,
  sendNotification,
  TITLE_MAX
} from "./notifications";
import type { RecipientTarget, SendFailure } from "./notifications";

const FAILURE_KEYS: Record<SendFailure, TranslationKey> = {
  config: "send.error.config",
  forbidden: "send.error.forbidden",
  noRecipients: "send.error.noRecipients",
  rateLimited: "send.error.rateLimited",
  unknown: "send.error.unknown"
};

export function SendNotificationModal({ onClose, organization }: { onClose: () => void; organization: Organization }) {
  const { t } = useT();
  const me = useCurrentUser();
  const [kind, setKind] = useState<RecipientTarget["kind"]>("org");
  const [role, setRole] = useState<string>(APP_ROLES[1].slug);
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<SendFailure | undefined>();
  const [sentTo, setSentTo] = useState<number | undefined>();

  const members = useQuery({
    enabled: kind === "user",
    queryFn: async () => {
      const response = ensureSuccess(await blocksClient.iam.users.list({ filter: { organizationIds: [organization.id] }, pageNo: 1, pageSize: 100 }));
      return (response.data ?? []).filter(isUserActive);
    },
    queryKey: ["iam", "users", organization.id, "recipients"]
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setFailure(undefined);
    setPending(true);
    try {
      const target: RecipientTarget = kind === "user" ? { kind, userId } : kind === "role" ? { kind, role } : { kind };
      const recipients = await resolveRecipients(organization.id, target);
      await sendNotification(recipients, {
        body: body.trim(),
        orgId: organization.id,
        sentBy: userDisplayName(me.data?.data) || "Admin",
        title: title.trim()
      });
      setSentTo(recipients.length);
      setTitle("");
      setBody("");
    } catch (caught) {
      // The composed message stays in the form on every failure.
      setFailure(classifySendError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title={t("send.title")} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        {failure ? <Alert tone="error">{t(FAILURE_KEYS[failure])}</Alert> : null}
        {sentTo !== undefined && !failure ? <Alert tone="info">{t("send.sent").replace("{count}", String(sentTo))}</Alert> : null}
        <SelectField label={t("send.to")} value={kind} onChange={(e) => setKind(e.target.value as RecipientTarget["kind"])}>
          <option value="org">{t("send.toOrg")} ({organization.name})</option>
          <option value="role">{t("send.toRole")}</option>
          <option value="user">{t("send.toUser")}</option>
        </SelectField>
        {kind === "role" ? (
          <SelectField label={t("field.role")} value={role} onChange={(e) => setRole(e.target.value)}>
            {APP_ROLES.map((entry) => <option key={entry.slug} value={entry.slug}>{entry.label}</option>)}
          </SelectField>
        ) : null}
        {kind === "user" ? (
          <SelectField label={t("send.toUser")} required value={userId} disabled={members.isLoading} onChange={(e) => setUserId(e.target.value)}>
            <option value="">{members.isLoading ? t("common.loading") : t("send.pickUser")}</option>
            {(members.data ?? []).map((user) => <option key={user.itemId} value={user.itemId}>{userDisplayName(user)}</option>)}
          </SelectField>
        ) : null}
        <FormField label={t("send.subject")} required maxLength={TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} hint={`${title.length}/${TITLE_MAX}`} />
        <TextAreaField label={t("send.message")} required rows={4} maxLength={BODY_MAX} value={body} onChange={(e) => setBody(e.target.value)} hint={`${body.length}/${BODY_MAX}`} />
        <div className="modal-actions">
          <button type="button" className="icon-button" onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className="primary-button" disabled={pending || (kind === "user" && !userId)}>
            <Send size={16} /> {pending ? t("common.working") : t("notifications.send")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
