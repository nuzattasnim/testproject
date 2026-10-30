import { Bell, UserRound, Users } from "lucide-react";
import { PERMISSIONS } from "../../lib/permissions";
import type { AppPermission } from "../../lib/permissions";

type NavItem = { href: string; icon: typeof UserRound; labelKey: "nav.profile" | "nav.users" | "nav.notifications"; permission?: AppPermission };

// `permission` hides an item from users who lack the FrontendAction; the
// page itself re-checks, so a typed URL still lands on the forbidden state.
export const navItems: readonly NavItem[] = [
  { href: "/", icon: UserRound, labelKey: "nav.profile" },
  { href: "/users", icon: Users, labelKey: "nav.users", permission: PERMISSIONS.usersRead },
  { href: "/notifications", icon: Bell, labelKey: "nav.notifications" }
];
