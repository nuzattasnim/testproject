import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { blocksClient } from "./mockClient";
import { renderWithProviders } from "./render";

vi.mock("../src/lib/blocks/client", async () => ({ blocksClient: (await import("./mockClient")).blocksClient }));

const { ActivationPage, isActivationValid } = await import("../src/features/activation/ActivationPage");

beforeEach(() => vi.clearAllMocks());

describe("ActivationPage", () => {
  it("asks for a code and makes no call when the code is missing (C1)", async () => {
    renderWithProviders(<ActivationPage onNavigate={vi.fn()} />);
    expect(await screen.findByLabelText("Activation code")).toBeTruthy();
    expect(blocksClient.auth.validateActivation).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Confirm password")).toBeNull();
  });

  it("routes a pasted code through the URL so it is validated like a link", async () => {
    const onNavigate = vi.fn();
    renderWithProviders(<ActivationPage onNavigate={onNavigate} />);
    await userEvent.type(await screen.findByLabelText("Activation code"), "  ABC 123 ");
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onNavigate).toHaveBeenCalledWith("/activate?code=ABC%20123");
  });

  it("warns but keeps the form when IAM says the code may be invalid", async () => {
    blocksClient.auth.validateActivation.mockResolvedValue({ isSuccess: false });
    blocksClient.auth.activate.mockResolvedValue({ isSuccess: true });
    renderWithProviders(<ActivationPage code="MAYBE" onNavigate={vi.fn()} />);

    expect(await screen.findByText(/may have expired/)).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Password"), "P@ssw0rd!23");
    await userEvent.type(screen.getByLabelText("Confirm password"), "P@ssw0rd!23");
    await userEvent.click(screen.getByRole("button", { name: /activate account/i }));

    expect(await screen.findByText("Account activated")).toBeTruthy();
    expect(blocksClient.auth.activate).toHaveBeenCalledWith({ code: "MAYBE", password: "P@ssw0rd!23" });
  });

  it("warns when the validation call itself fails", async () => {
    blocksClient.auth.validateActivation.mockRejectedValue(new Error("boom"));
    renderWithProviders(<ActivationPage code="VALID" onNavigate={vi.fn()} />);
    expect(await screen.findByText(/may have expired/)).toBeTruthy();
    expect(screen.getByLabelText("Confirm password")).toBeTruthy();
  });

  it("shows no warning for a valid code", async () => {
    blocksClient.auth.validateActivation.mockResolvedValue({ isSuccess: true });
    renderWithProviders(<ActivationPage code="VALID" onNavigate={vi.fn()} />);
    await waitFor(() => expect(blocksClient.auth.validateActivation).toHaveBeenCalled());
    expect(await screen.findByLabelText("Confirm password")).toBeTruthy();
    expect(screen.queryByText(/may have expired/)).toBeNull();
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

  it("sends optional names only when typed", async () => {
    blocksClient.auth.validateActivation.mockResolvedValue({ isSuccess: true });
    blocksClient.auth.activate.mockResolvedValue({ isSuccess: true });
    renderWithProviders(<ActivationPage code="VALID" onNavigate={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText("First name"), " Bob ");
    await userEvent.type(screen.getByLabelText("Password"), "P@ssw0rd!23");
    await userEvent.type(screen.getByLabelText("Confirm password"), "P@ssw0rd!23");
    await userEvent.click(screen.getByRole("button", { name: /activate account/i }));

    expect(await screen.findByText("Account activated")).toBeTruthy();
    expect(blocksClient.auth.activate).toHaveBeenCalledWith({ code: "VALID", firstName: "Bob", password: "P@ssw0rd!23" });
  });

  it("blocks submit when the password is shorter than 8 characters", async () => {
    blocksClient.auth.validateActivation.mockResolvedValue({ isSuccess: true });
    renderWithProviders(<ActivationPage code="VALID" onNavigate={vi.fn()} />);

    await userEvent.type(await screen.findByLabelText("Password"), "short");
    await userEvent.type(screen.getByLabelText("Confirm password"), "short");
    await userEvent.click(screen.getByRole("button", { name: /activate account/i }));

    expect(await screen.findByText("Password must be at least 8 characters.")).toBeTruthy();
    expect(blocksClient.auth.activate).not.toHaveBeenCalled();
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

    await userEvent.click(await screen.findByRole("button", { name: /need a new link/i }));
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
