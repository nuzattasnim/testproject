import { ShieldOff } from "lucide-react";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { EmptyState } from "../../shared/ui/EmptyState";

export function Forbidden() {
  const { t } = useT();
  return <EmptyState icon={<ShieldOff size={22} />} title={t("forbidden.title")} description={t("forbidden.message")} />;
}
