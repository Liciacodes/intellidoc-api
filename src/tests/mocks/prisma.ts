import { vi } from "vitest";

export const prismaMock = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
};