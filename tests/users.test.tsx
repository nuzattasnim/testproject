import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { blocksClient } from "./mockClient";
import { renderWithProviders } from "./render";

vi.mock("../src/lib/blocks/client", async () => ({ blocksClient: (await import("./mockClient")).blocksClient }));
vi.mock("../src/app/providers/AuthProvider", () => ({
  useAuth: () => ({ claims: {}, login: vi.fn(), logout: vi.fn(), refresh: vi.fn(async () => undefined), status: "authenticated" })
}));

const { UsersPage } = await import("../src/features/users/UsersPage");

const ADMIN_PERMISSIONS = ["testproject::users::read", "testproject::users::manage", "testproject::notifications::send"];

function signInAs(permissions: string[], itemId = "admin-1") {
  blocksClient.iam.me.mockResolvedValue({ data: { email: "admin@example.com", firstName: "Ann", itemId, organizationId: "alpha", permissions, roles: ["org-admin"] } });
  blocksClient.iam.organizations.my.mockResolvedValue({ organizations: [{ itemId: "alpha", name: "Org Alpha" }, { itemId: "beta", name: "Org Beta" }] });
}

beforeEach(() => vi.clearAllMocks());

describe("UsersPage", () => {
  it("renders the forbidden state and never lists users without the permission (C4)", async () => {
    signInAs([]);
    renderWithProviders(<UsersPage />);
    expect(await screen.findByText("You don't have access")).toBeTruthy();
    expect(blocksClient.iam.users.list).not.toHaveBeenCalled();
  });

  it("lists only the active organization's users, 20 per page (H5)", async () => {
    signInAs(ADMIN_PERMISSIONS);
    blocksClient.iam.users.list.mockResolvedValue({ data: [{ active: true, email: "bob@example.com", firstName: "Bob", itemId: "u2", roles: ["member"] }], totalCount: 1 });
    renderWithProviders(<UsersPage />);

    expect(await screen.findByText("bob@example.com")).toBeTruthy();
    expect(blocksClient.iam.users.list).toHaveBeenCalledWith({ filter: { organizationIds: ["alpha"] }, pageNo: 1, pageSize: 20, search: undefined });
  });

  it("disables changing or deactivating your own account (C12)", async () => {
    signInAs(ADMIN_PERMISSIONS, "admin-1");
    blocksClient.iam.users.list.mockResolvedValue({ data: [{ active: true, email: "admin@example.com", firstName: "Ann", itemId: "admin-1", roles: ["org-admin"] }], totalCount: 1 });
    renderWithProviders(<UsersPage />);

    expect(((await screen.findByRole("button", { name: "Change role" })) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Deactivate" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("invites into the active org with the chosen role slug (H6)", async () => {
    signInAs(ADMIN_PERMISSIONS);
    blocksClient.iam.users.list.mockResolvedValue({ data: [], totalCount: 0 });
    blocksClient.iam.users.emailAvailable.mockResolvedValue({ isAvailable: true });
    blocksClient.iam.users.create.mockResolvedValue({ isSuccess: true });
    renderWithProviders(<UsersPage />);

    await userEvent.click(await screen.findByRole("button", { name: /invite user/i }));
    await userEvent.type(screen.getByLabelText("First name"), "New");
    await userEvent.type(screen.getByLabelText("Last name"), "Hire");
    await userEvent.type(screen.getByLabelText("Email"), "new.hire@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() => expect(blocksClient.iam.users.create).toHaveBeenCalledWith({
      email: "new.hire@example.com",
      firstName: "New",
      lastName: "Hire",
      organizationId: "alpha",
      roles: ["member"]
    }));
    expect(await screen.findByText(/Invitation sent to new.hire@example.com/)).toBeTruthy();
  });

  it("stops before create when the email is taken (C3)", async () => {
    signInAs(ADMIN_PERMISSIONS);
    blocksClient.iam.users.list.mockResolvedValue({ data: [], totalCount: 0 });
    blocksClient.iam.users.emailAvailable.mockResolvedValue({ IsAvailable: false });
    renderWithProviders(<UsersPage />);

    await userEvent.click(await screen.findByRole("button", { name: /invite user/i }));
    await userEvent.type(screen.getByLabelText("First name"), "Dup");
    await userEvent.type(screen.getByLabelText("Last name"), "User");
    await userEvent.type(screen.getByLabelText("Email"), "taken@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send invite/i }));

    expect(await screen.findByText("This email is already registered.")).toBeTruthy();
    expect(blocksClient.iam.users.create).not.toHaveBeenCalled();
  });

  it("changes the role with the full set and notifies the user (H7)", async () => {
    signInAs(ADMIN_PERMISSIONS);
    blocksClient.iam.users.list.mockResolvedValue({ data: [{ active: true, email: "bob@example.com", firstName: "Bob", itemId: "u2", roles: ["member"] }], totalCount: 1 });
    blocksClient.iam.users.updateAccess.mockResolvedValue({ isSuccess: true });
    blocksClient.notifier.notify.mockResolvedValue({});
    renderWithProviders(<UsersPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Change role" }));
    await userEvent.selectOptions(screen.getByLabelText("Role"), "org-admin");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(blocksClient.iam.users.updateAccess).toHaveBeenCalledWith({ organizationId: "alpha", roles: ["org-admin"], userId: "u2" }));
    await waitFor(() => expect(blocksClient.notifier.notify).toHaveBeenCalledTimes(1));
    expect(blocksClient.notifier.notify.mock.calls[0]?.[0].userIds).toEqual(["u2"]);
  });
});
