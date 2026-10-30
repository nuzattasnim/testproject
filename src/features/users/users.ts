import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlocksUser } from "@seliseblocks/client";
import { blocksClient } from "../../lib/blocks/client";
import { ensureSuccess } from "../../lib/blocks/errors";

export const USERS_PAGE_SIZE = 20;

export function useOrgUsers(orgId: string | undefined, page: number, search: string, enabled: boolean) {
  return useQuery({
    enabled: enabled && Boolean(orgId),
    queryFn: async () => {
      // POST-read; the org filter keeps every row inside the active org.
      const response = ensureSuccess(await blocksClient.iam.users.list({
        filter: { organizationIds: [orgId] },
        pageNo: page,
        pageSize: USERS_PAGE_SIZE,
        search: search || undefined
      }));
      return { total: response.totalCount ?? response.data?.length ?? 0, users: response.data ?? [] };
    },
    placeholderData: (previous) => previous,
    queryKey: ["iam", "users", orgId, page, search]
  });
}

export function userRoles(user: BlocksUser): string[] {
  return Array.isArray(user.roles) ? user.roles : [];
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["iam", "users"] });
}

export type InviteInput = { email: string; firstName: string; lastName: string; organizationId: string; role: string };

export function useInviteUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async (input: InviteInput) => {
      const availability = await blocksClient.iam.users.emailAvailable({ email: input.email });
      if (availability.isAvailable === false || availability.IsAvailable === false) {
        throw new Error("This email is already registered.");
      }
      // No password: IAM creates the account inactive and emails the
      // activation link that lands on /activate.
      return ensureSuccess(await blocksClient.iam.users.create({
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        organizationId: input.organizationId,
        roles: [input.role]
      }));
    },
    onSuccess: invalidate
  });
}

export function useChangeRole() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    // A non-empty roles list replaces the org's current list, so send the
    // complete set the user should end up with.
    mutationFn: async ({ organizationId, role, userId }: { organizationId: string; role: string; userId: string }) =>
      ensureSuccess(await blocksClient.iam.users.updateAccess({ organizationId, roles: [role], userId })),
    onSuccess: invalidate
  });
}

export function useSetUserActive() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: async ({ active, reason, userId }: { active: boolean; reason?: string; userId: string }) => {
      if (active) {
        if (!reason?.trim()) throw new Error("A reason is required to reactivate a user.");
        return ensureSuccess(await blocksClient.iam.users.activate({ reason: reason.trim(), userId }));
      }
      return ensureSuccess(await blocksClient.iam.users.deactivate({ userId }));
    },
    onSuccess: invalidate
  });
}
