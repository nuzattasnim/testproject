import type { BlocksUser } from "@seliseblocks/client";

// FrontendAction permissions configured in Blocks IAM for this app. They
// only gate what the UI shows; the gateway still enforces the matching
// Endpoint permissions on every call (a hidden button is not a control).
export const PERMISSIONS = {
  notificationsSend: "testproject::notifications::send",
  usersManage: "testproject::users::manage",
  usersRead: "testproject::users::read"
} as const;

export type AppPermission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Roles are referenced by slug, never by IAM item id.
export const APP_ROLES = [
  { label: "Org admin", slug: "org-admin" },
  { label: "Member", slug: "member" }
] as const;

export type AppRoleSlug = (typeof APP_ROLES)[number]["slug"];

export function roleLabel(slug: string): string {
  return APP_ROLES.find((role) => role.slug === slug)?.label ?? slug;
}

export function hasPermission(user: BlocksUser | undefined, permission: AppPermission): boolean {
  return Boolean(user?.permissions?.includes(permission));
}
