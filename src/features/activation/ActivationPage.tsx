import { useQuery } from "@tanstack/react-query";
import { ArrowRight, KeyRound, Send } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { blocksClient } from "../../lib/blocks/client";
import { ensureSuccess, errorMessage } from "../../lib/blocks/errors";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Alert } from "../../shared/ui/Alert";
import { FormField } from "../../shared/ui/FormField";
import { AuthCard, AuthLink } from "../auth/AuthCard";

export const MIN_PASSWORD_LENGTH = 8;

type Navigate = (path: string) => void;

// IAM's validate response is a loose record: treat an explicit false on any
// of the known flags (or isSuccess: false, or a thrown error) as invalid.
export function isActivationValid(response: Record<string, unknown>): boolean {
  if (response.isSuccess === false) return false;
  return response.valid !== false && response.isValid !== false;
}

export function ActivationPage({ code, onNavigate }: { code?: string; onNavigate: Navigate }) {
  const [resend, setResend] = useState(false);
  const validation = useQuery({
    // No code means no API call at all -- ask for one instead.
    enabled: Boolean(code),
    queryFn: async () => isActivationValid(await blocksClient.auth.validateActivation({ code })),
    queryKey: ["auth", "activation", code],
    retry: false,
    staleTime: Infinity
  });

  if (resend) return <ResendCard onBack={() => setResend(false)} onNavigate={onNavigate} />;
  if (!code) return <EnterCode onNavigate={onNavigate} onResend={() => setResend(true)} />;

  // Pre-validation is advisory only: IAM has reported valid codes as invalid,
  // so a negative or failed check warns but never hides the form. activate()
  // is the real check and surfaces its own error.
  const maybeExpired = validation.isError || (validation.isSuccess && validation.data === false);
  return <SetPassword code={code} maybeExpired={maybeExpired} onNavigate={onNavigate} onResend={() => setResend(true)} />;
}

// Manual entry for users who only have the code. It goes back through the
// URL so a pasted code is validated exactly like a clicked link.
function EnterCode({ onNavigate, onResend }: { onNavigate: Navigate; onResend: () => void }) {
  const { t } = useT();
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onNavigate(`/activate?code=${encodeURIComponent(trimmed)}`);
  }

  return (
    <AuthCard title={t("activate.enterCodeTitle")} subtitle={t("activate.enterCodeMessage")}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField label={t("field.activationCode")} autoComplete="one-time-code" required value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="primary-button auth-submit" type="submit" disabled={!value.trim()}>
          {t("activate.continue")} <ArrowRight size={18} />
        </button>
      </form>
      <AuthFooter onNavigate={onNavigate} onResend={onResend} />
    </AuthCard>
  );
}

function ResendCard({ onBack, onNavigate }: { onBack: () => void; onNavigate: Navigate }) {
  const { t } = useT();
  return (
    <AuthCard title={t("activate.resendTitle")} subtitle={t("activate.invalidMessage")}>
      <ResendForm />
      <button className="link-button auth-link" type="button" onClick={onBack}>{t("activate.backToActivation")}</button>
      <AuthLink href="/login" label={t("auth.back")} onNavigate={onNavigate} />
    </AuthCard>
  );
}

function SetPassword({ code, maybeExpired, onNavigate, onResend }: { code: string; maybeExpired: boolean; onNavigate: Navigate; onResend: () => void }) {
  const { t } = useT();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tooShort, setTooShort] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setTooShort(true);
      return;
    }
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      // Names are optional: invited users already have them from the invite,
      // so only send what was actually typed and never blank them out.
      const payload: { code: string; password: string; firstName?: string; lastName?: string } = { code, password };
      if (firstName.trim()) payload.firstName = firstName.trim();
      if (lastName.trim()) payload.lastName = lastName.trim();
      ensureSuccess(await blocksClient.auth.activate(payload));
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
        <button className="primary-button auth-submit" onClick={() => onNavigate("/login")}>{t("activate.goToLogin")} <ArrowRight size={18} /></button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("activate.title")} subtitle={t("activate.subtitle")}>
      <form className="auth-form" onSubmit={handleSubmit}>
        {maybeExpired ? (
          <Alert tone="warn">
            {t("activate.maybeExpired")}{" "}
            <button className="link-button" type="button" onClick={onResend}>{t("activate.requestNewLink")}</button>
          </Alert>
        ) : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="form-row">
          <FormField label={t("field.firstName")} placeholder={t("field.optional")} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <FormField label={t("field.lastName")} placeholder={t("field.optional")} autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <FormField
          label={t("field.password")}
          type="password"
          autoComplete="new-password"
          required
          value={password}
          error={tooShort ? t("password.tooShort") : undefined}
          onChange={(e) => { setPassword(e.target.value); setTooShort(false); setMismatch(false); }}
        />
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
      <AuthFooter onNavigate={onNavigate} onResend={onResend} />
    </AuthCard>
  );
}

function AuthFooter({ onNavigate, onResend }: { onNavigate: Navigate; onResend: () => void }) {
  const { t } = useT();
  return (
    <div className="auth-footer">
      <button className="link-button" type="button" onClick={onResend}>{t("activate.needNewLink")}</button>
      <AuthLink href="/login" label={t("auth.back")} onNavigate={onNavigate} />
    </div>
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
