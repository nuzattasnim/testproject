import { useQuery } from "@tanstack/react-query";
import { KeyRound, Send } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { blocksClient } from "../../lib/blocks/client";
import { ensureSuccess, errorMessage } from "../../lib/blocks/errors";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Alert } from "../../shared/ui/Alert";
import { FormField } from "../../shared/ui/FormField";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";
import { AuthCard, AuthLink } from "../auth/AuthCard";

// IAM's validate response is a loose record: treat an explicit false on any
// of the known flags (or isSuccess: false, or a thrown error) as invalid.
export function isActivationValid(response: Record<string, unknown>): boolean {
  if (response.isSuccess === false) return false;
  return response.valid !== false && response.isValid !== false;
}

export function ActivationPage({ code, onNavigate }: { code?: string; onNavigate: (path: string) => void }) {
  const validation = useQuery({
    // No code means no API call at all -- straight to the invalid-link state.
    enabled: Boolean(code),
    queryFn: async () => isActivationValid(await blocksClient.auth.validateActivation({ code })),
    queryKey: ["auth", "activation", code],
    retry: false,
    staleTime: Infinity
  });

  if (code && validation.isLoading) return <LoadingScreen />;

  const valid = Boolean(code) && validation.isSuccess && validation.data === true;
  if (!valid) return <InvalidLink onNavigate={onNavigate} />;

  return <SetPassword code={code as string} onNavigate={onNavigate} />;
}

function InvalidLink({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useT();
  return (
    <AuthCard title={t("activate.invalidTitle")} subtitle={t("activate.invalidMessage")}>
      <ResendForm />
      <AuthLink href="/login" label={t("auth.back")} onNavigate={onNavigate} />
    </AuthCard>
  );
}

function SetPassword({ code, onNavigate }: { code: string; onNavigate: (path: string) => void }) {
  const { t } = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      ensureSuccess(await blocksClient.auth.activate({ code, password }));
      setDone(true);
    } catch (caught) {
      setError(errorMessage(caught, t("activate.failed")));
      setPassword("");
      setConfirm("");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <AuthCard title={t("activate.doneTitle")} subtitle={t("activate.doneMessage")}>
        <button className="primary-button auth-submit" onClick={() => onNavigate("/login")}>{t("activate.goToLogin")}</button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("activate.title")} subtitle={t("activate.subtitle")}>
      <form className="auth-form" onSubmit={handleSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <FormField label={t("field.password")} type="password" autoComplete="new-password" required value={password} onChange={(e) => { setPassword(e.target.value); setMismatch(false); }} />
        <FormField
          label={t("field.confirmPassword")}
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          error={mismatch ? t("password.mismatch") : undefined}
          onChange={(e) => { setConfirm(e.target.value); setMismatch(false); }}
        />
        <button className="primary-button auth-submit" type="submit" disabled={pending}>
          <KeyRound size={18} /> {pending ? t("common.working") : t("activate.submit")}
        </button>
      </form>
    </AuthCard>
  );
}

function ResendForm() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      await blocksClient.auth.resendActivation({ email: email.trim() });
    } catch {
      // Deliberately swallowed: the answer must look the same whether or not
      // the account exists, so nothing here may reveal registration.
    } finally {
      setPending(false);
      setSent(true);
    }
  }

  if (sent) return <Alert tone="info">{t("activate.resent")}</Alert>;

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <FormField label={t("field.email")} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="primary-button auth-submit" type="submit" disabled={pending}>
        <Send size={18} /> {pending ? t("common.working") : t("activate.resend")}
      </button>
    </form>
  );
}
