import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlocksOrganization } from "@seliseblocks/client";
import { useAuth } from "../../app/providers/AuthProvider";
import { adoptAuthResponse } from "../../lib/blocks/auth";
import { blocksClient } from "../../lib/blocks/client";
import { ensureSuccess } from "../../lib/blocks/errors";
import { useCurrentUser } from "../profile/useCurrentUser";

export type Organization = { id: string; name: string };

function normalizeOrganization(raw: BlocksOrganization): Organization | undefined {
  const id = (raw.itemId ?? raw.organizationId ?? raw.id) as string | undefined;
  if (!id) return undefined;
  return { id, name: String(raw.name ?? raw.organizationName ?? id) };
}

export function useMyOrganizations() {
  const { status } = useAuth();
  return useQuery({
    enabled: status === "authenticated",
    queryFn: async () => {
      const response = ensureSuccess(await blocksClient.iam.organizations.my());
      return (response.organizations ?? []).map(normalizeOrganization).filter((org): org is Organization => Boolean(org));
    },
    queryKey: ["iam", "organizations", "my"],
    staleTime: 5 * 60_000
  });
}

// The active organization is whatever the IAM session says it is (iam.me()
// or the session claims). Falling back to the first membership keeps
// single-org users working when IAM omits the field.
export function useActiveOrganization(): { organization?: Organization; organizations: Organization[]; isLoading: boolean } {
  const me = useCurrentUser();
  const { claims } = useAuth();
  const orgs = useMyOrganizations();
  const organizations = orgs.data ?? [];
  const profile = me.data?.data as Record<string, unknown> | undefined;
  const activeId = (profile?.organizationId ?? profile?.activeOrganizationId ?? claims?.org_id ?? claims?.organization_id) as string | undefined;
  const organization = organizations.find((org) => org.id === activeId)
    ?? (activeId ? { id: activeId, name: activeId } : organizations[0]);
  return { isLoading: me.isLoading || orgs.isLoading, organization, organizations };
}

export function useSwitchOrganization() {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  return useMutation({
    mutationFn: async (organizationId: string) => {
      const response = await blocksClient.auth.switchOrganization({ organizationId });
      adoptAuthResponse(response as Record<string, unknown>);
      return response;
    },
    onSuccess: async () => {
      // Everything cached belongs to the previous org context -- drop it all
      // rather than risk showing one org's users or notifications in another.
      queryClient.removeQueries();
      await refresh();
    }
  });
}
