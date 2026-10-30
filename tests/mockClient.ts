import { vi } from "vitest";

// One shared fake of the app's single blocksClient instance.
export const blocksClient = {
  auth: {
    activate: vi.fn(),
    logout: vi.fn(),
    resendActivation: vi.fn(),
    signup: vi.fn(),
    switchOrganization: vi.fn(),
    userInfo: vi.fn(),
    validateActivation: vi.fn()
  },
  iam: {
    me: vi.fn(),
    organizations: { my: vi.fn() },
    users: {
      activate: vi.fn(),
      create: vi.fn(),
      deactivate: vi.fn(),
      emailAvailable: vi.fn(),
      list: vi.fn(),
      updateAccess: vi.fn()
    }
  },
  localization: { languages: vi.fn(async () => []), translations: vi.fn(async () => ({})) },
  notifier: {
    getNotifications: vi.fn(),
    markAllNotificationAsRead: vi.fn(),
    markNotificationAsRead: vi.fn(),
    notify: vi.fn()
  }
};
