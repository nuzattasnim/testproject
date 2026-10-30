import { UserPlus } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { blocksClient } from "../../lib/blocks/client";
import { ensureSuccess, errorMessage } from "../../lib/blocks/errors";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Alert } from "../../shared/ui/Alert";
import { FormField } from "../../shared/ui/FormField";
import { AuthCard, AuthLink } from "../auth/AuthCard";

type Form = { confirmPassword: string; email: string; firstName: string; lastName: string; password: string };
const EMPTY: Form = { confirmPassword: "", email: "", firstName: "", lastName: "", password: "" };

export function SignupPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useT();
  const [form, setForm] = useState<Form>(EMPTY);
  const [mismatch, setMismatch] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  function update(field: keyof Form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === "password" || field === "confirmPassword") setMismatch(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    // Confirm-password is a UI-only check: IAM gets the password once.
    if (form.password !== form.confirmPassword) {
      setMismatch(true);
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      ensureSuccess(await blocksClient.auth.signup({
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        password: form.password
      }));
      setDone(true);
    } catch (caught) {
      // IAM owns account rules (duplicates, password policy): show its
      // message, keep what the user typed except the passwords.
      setError(errorMessage(caught, t("signup.failed")));
      setForm((current) => ({ ...current, confirmPassword: "", password: "" }));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <AuthCard title={t("signup.doneTitle")} subtitle={t("signup.doneMessage")}>
        <AuthLink href="/login" label={t("auth.back")} onNavigate={onNavigate} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("signup.title")} subtitle={t("signup.subtitle")}>
      <form className="auth-form" onSubmit={handleSubmit} noValidate={false}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="form-row">
          <FormField label={t("field.firstName")} autoComplete="given-name" required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
          <FormField label={t("field.lastName")} autoComplete="family-name" required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
        </div>
        <FormField label={t("field.email")} type="email" autoComplete="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
        <FormField label={t("field.password")} type="password" autoComplete="new-password" required value={form.password} onChange={(e) => update("password", e.target.value)} />
        <FormField
          label={t("field.confirmPassword")}
          type="password"
          autoComplete="new-password"
          required
          value={form.confirmPassword}
          error={mismatch ? t("password.mismatch") : undefined}
          onChange={(e) => update("confirmPassword", e.target.value)}
        />
        <button className="primary-button auth-submit" type="submit" disabled={pending}>
          <UserPlus size={18} /> {pending ? t("common.working") : t("signup.submit")}
        </button>
      </form>
      <AuthLink href="/login" label={t("signup.haveAccount")} onNavigate={onNavigate} />
    </AuthCard>
  );
}
