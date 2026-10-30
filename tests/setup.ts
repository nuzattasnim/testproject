import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// jsdom has no matchMedia; AppShell-style hooks read it.
Object.defineProperty(window, "matchMedia", {
  value: (query: string) => ({ addEventListener: vi.fn(), matches: false, media: query, removeEventListener: vi.fn() }),
  writable: true
});
