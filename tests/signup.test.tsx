import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BlocksApiError } from "@seliseblocks/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { blocksClient } from "./mockClient";
import { renderWithProviders } from "./render";

vi.mock("../src/lib/blocks/client", async () => ({ blocksClient: (await import("./mockClient")).blocksClient }));

const { SignupPage } = await import("../src/features/signup/SignupPage");

beforeEach(() => vi.clearAllMocks());

async function fillForm(password = "P@ssw0rd!23", confirm = password) {
  await userEvent.type(screen.getByLabelText("First name"), "Ada");
  await userEvent.type(screen.getByLabelText("Last name"), "Lovelace");
  await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.type(screen.getByLabelText("Confirm password"), confirm);
}

describe("SignupPage", () => {
  it("calls signup once and shows the check-email message (H1)", async () => {
    blocksClient.auth.signup.mockResolvedValue({ isSuccess: true });
    renderWithProviders(<SignupPage onNavigate={vi.fn()} />);
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Check your email")).toBeTruthy();
    expect(blocksClient.auth.signup).toHaveBeenCalledTimes(1);
    expect(blocksClient.auth.signup).toHaveBeenCalledWith({ email: "ada@example.com", firstName: "Ada", lastName: "Lovelace", password: "P@ssw0rd!23" });
  });

  it("makes no call when the passwords differ (C2)", async () => {
    renderWithProviders(<SignupPage onNavigate={vi.fn()} />);
    await fillForm("one-password", "two-password");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Passwords do not match.")).toBeTruthy();
    expect(blocksClient.auth.signup).not.toHaveBeenCalled();
  });

  it("shows IAM's error, keeps non-password fields, clears passwords (C3)", async () => {
    blocksClient.auth.signup.mockRejectedValue(new BlocksApiError(400, "Bad Request", { errors: { Email: "Email already exists" } }));
    renderWithProviders(<SignupPage onNavigate={vi.fn()} />);
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Email already exists")).toBeTruthy();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("ada@example.com");
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("button", { name: /create account/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("treats a 200 with isSuccess:false as a failure (C3)", async () => {
    blocksClient.auth.signup.mockResolvedValue({ errors: { Password: "Password too weak" }, isSuccess: false });
    renderWithProviders(<SignupPage onNavigate={vi.fn()} />);
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText("Password too weak")).toBeTruthy();
  });
});
