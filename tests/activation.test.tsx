import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { blocksClient } from "./mockClient";
import { renderWithProviders } from "./render";

vi.mock("../src/lib/blocks/client", async () => ({ blocksClient: (await import("./mockClient")).blocksClient }));

const { ActivationPage, isActivationValid } = await import("../src/features/activation/ActivationPage");

beforeEach(() => vi.clearAllMocks());

describe("ActivationPage", () => {
  it("shows the invalid-link state and makes no call when the code is missing (C1)", async () => {
    renderWithProviders(<ActivationPage onNavigate={vi.fn()} />);
    expect(await screen.findByText("This link has expired or is invalid")).toBeTruthy();
    expect(blocksClient.auth.validateActivation).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Confirm password")).toBeNull();
  });

  it("shows the invalid-link state when IAM rejects the code (C1)", async () => {
    blocksClient.auth.validateActivation.mockResolvedValue({ isSuccess: false });
    renderWithProviders(<ActivationPage code="EXPIRED" onNavigate={vi.fn()} />);
    expect(await screen.findByText("This link has expired or is invalid")).toBeTruthy();
    expect(blocksClient.auth.activate).not.toHaveBeenCalled();
  });

  it("validates first, then activates with code and password only (H2, H3)", async () => {
    blocksClient.auth.validateActivation.mockResolvedValue({ isSuccess: true });
    blocksClient.auth.activate.mockResolvedValue({ isSuccess: true });
    renderWithProviders(<ActivationPage code="VALID" onNavigate={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText("Password"), "P@ssw0rd!23");
    await userEvent.type(screen.getByLabelText("Confirm password"), "P@ssw0rd!23");
    await userEvent.click(screen.getByRole("button", { name: /activate account/i }));

    expect(await screen.findByText("Account activated")).toBeTruthy();
    expect(blocksClient.auth.validateActivation).toHaveBeenCalledWith({ code: "VALID" });
    expect(blocksClient.auth.activate).toHaveBeenCalledWith({ code: "VALID", password: "P@ssw0rd!23" });
  });

  it("blocks submit with a linked error when passwords differ (C2)", async () => {
    blocksClient.auth.validateActivation.mockResolvedValue({ isSuccess: true });
    renderWithProviders(<ActivationPage code="VALID" onNavigate={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText("Password"), "one-password");
    const confirm = screen.getByLabelText("Confirm password");
    await userEvent.type(confirm, "other-password");
    await userEvent.click(screen.getByRole("button", { name: /activate account/i }));

    const error = await screen.findByText("Passwords do not match.");
    expect(confirm.getAttribute("aria-describedby")).toBe(error.id);
    expect(blocksClient.auth.activate).not.toHaveBeenCalled();
  });

  it("shows the same resend confirmation even when IAM errors (C6)", async () => {
    blocksClient.auth.resendActivation.mockRejectedValue(new Error("no such user"));
    renderWithProviders(<ActivationPage onNavigate={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText("Email"), "nobody@example.com");
    await userEvent.click(screen.getByRole("button", { name: /send a new link/i }));

    await waitFor(() => expect(screen.getByText(/If an account exists for that email/)).toBeTruthy());
  });
});

describe("isActivationValid", () => {
  it("treats explicit false flags as invalid", () => {
    expect(isActivationValid({ isSuccess: true })).toBe(true);
    expect(isActivationValid({ valid: false })).toBe(false);
    expect(isActivationValid({ isValid: false })).toBe(false);
  });
});
