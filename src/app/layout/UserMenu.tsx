import { Building2, Check, LogOut } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import { useCurrentUser, userDisplayName, userInitials } from "../../features/profile/useCurrentUser";
import { useActiveOrganization, useSwitchOrganization } from "../../features/organizations/useOrganizations";
import { useT } from "../../lib/i18n/LocalizationProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "../../shared/ui/dropdown-menu";

export function UserMenu({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { logout } = useAuth();
  const { t } = useT();
  const me = useCurrentUser();
  const profile = me.data?.data;
  const name = userDisplayName(profile) || (me.isLoading ? "Loading..." : "Guest");
  const roles = profile?.roles ?? [];
  const { organization, organizations } = useActiveOrganization();
  const switchOrg = useSwitchOrganization();

  function handleLogout() {
    logout();
    onNavigate("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="user-menu-trigger" aria-label="Open user menu">
        <span className="avatar avatar-sm">{userInitials(profile)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[280px]">
        <DropdownMenuLabel className="flex items-center gap-3 font-normal">
          <span className="avatar avatar-lg">{userInitials(profile)}</span>
          <div className="grid gap-0.5 overflow-hidden">
            <strong className="truncate text-sm font-semibold">{name}</strong>
            {profile?.email ? <small className="truncate text-xs text-[hsl(var(--muted-foreground))]">{profile.email}</small> : null}
            {roles.length > 0 ? <small className="truncate text-xs capitalize text-[hsl(var(--muted-foreground))]">{roles.join(", ")}</small> : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.length > 1 ? (
          <>
            <DropdownMenuLabel className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{t("org.switch")}</DropdownMenuLabel>
            {organizations.map((org) => {
              const active = org.id === organization?.id;
              return (
                <DropdownMenuItem
                  key={org.id}
                  disabled={active || switchOrg.isPending}
                  aria-current={active ? "true" : undefined}
                  onSelect={() => switchOrg.mutate(org.id)}
                >
                  <Building2 size={18} /> <span className="flex-1 truncate">{org.name}</span>
                  {active ? <Check size={16} aria-label={t("org.current")} /> : null}
                </DropdownMenuItem>
              );
            })}
            {switchOrg.isError ? <p className="px-2 py-1 text-xs text-[hsl(var(--destructive))]" role="alert">{t("org.switchFailed")}</p> : null}
            <DropdownMenuSeparator />
          </>
        ) : organization ? (
          <>
            <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal text-[hsl(var(--muted-foreground))]">
              <Building2 size={14} /> {organization.name}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem destructive onSelect={handleLogout}>
          <LogOut size={18} /> {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
