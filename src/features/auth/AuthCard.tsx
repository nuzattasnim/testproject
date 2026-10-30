import { Activity } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "../../lib/i18n/LocalizationProvider";

// Same centered card as LoginPage, shared by the public signup and
// activation screens so all pre-login pages look like one flow.
export function AuthCard({ children, subtitle, title }: { children: ReactNode; subtitle?: string; title: string }) {
  const { t } = useT();
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand"><span className="brand-mark"><Activity size={18} /></span><span>{t("app.name")}</span></div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function AuthLink({ href, label, onNavigate }: { href: string; label: string; onNavigate: (path: string) => void }) {
  return (
    <a className="link-button auth-link" href={href} onClick={(event) => { event.preventDefault(); onNavigate(href); }}>
      {label}
    </a>
  );
}
