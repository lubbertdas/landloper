import { describe, expect, it } from "vitest";

describe("toolchain", () => {
  it("runs TypeScript under vitest", () => {
    const metres: number = 1_000;
    expect(metres).toBe(1000);
  });
});
