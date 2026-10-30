import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldExtras = { error?: string; hint?: string; label: string };

// One wrapper for every field type so labels, hints and error wiring
// (aria-invalid + aria-describedby) stay identical across forms.
function FieldShell({ children, error, errorId, hint, hintId, label }: FieldExtras & { children: ReactNode; errorId: string; hintId: string }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {hint && !error ? <small id={hintId} className="form-hint">{hint}</small> : null}
      {error ? <small id={errorId} className="form-error" role="alert">{error}</small> : null}
    </label>
  );
}

function useFieldIds(error?: string, hint?: string) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  return { describedBy, errorId, hintId };
}

export function FormField({ error, hint, label, ...props }: InputHTMLAttributes<HTMLInputElement> & FieldExtras) {
  const ids = useFieldIds(error, hint);
  return (
    <FieldShell error={error} errorId={ids.errorId} hint={hint} hintId={ids.hintId} label={label}>
      <input aria-describedby={ids.describedBy} aria-invalid={error ? true : undefined} {...props} />
    </FieldShell>
  );
}

export function SelectField({ children, error, hint, label, ...props }: SelectHTMLAttributes<HTMLSelectElement> & FieldExtras) {
  const ids = useFieldIds(error, hint);
  return (
    <FieldShell error={error} errorId={ids.errorId} hint={hint} hintId={ids.hintId} label={label}>
      <select aria-describedby={ids.describedBy} aria-invalid={error ? true : undefined} {...props}>{children}</select>
    </FieldShell>
  );
}

export function TextAreaField({ error, hint, label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldExtras) {
  const ids = useFieldIds(error, hint);
  return (
    <FieldShell error={error} errorId={ids.errorId} hint={hint} hintId={ids.hintId} label={label}>
      <textarea aria-describedby={ids.describedBy} aria-invalid={error ? true : undefined} {...props} />
    </FieldShell>
  );
}
