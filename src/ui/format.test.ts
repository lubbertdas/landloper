import { describe, expect, it } from "vitest";

import { formatDistance, formatDistanceShort, formatDuration, parseDistance } from "./format";

describe("formatDistance", () => {
  it("shows metres under 1 km and kilometres above", () => {
    expect(formatDistance(0, "km")).toBe("0 m");
    expect(formatDistance(849.6, "km")).toBe("850 m");
    expect(formatDistance(1250, "km")).toBe("1.25 km");
    expect(formatDistance(12_440, "km")).toBe("12.4 km");
  });

  it("shows miles with two decimals under 10", () => {
    expect(formatDistance(1609.344, "mi")).toBe("1.00 mi");
    expect(formatDistance(20_000, "mi")).toBe("12.4 mi");
  });

  it("never shows a negative distance", () => {
    expect(formatDistance(-5, "km")).toBe("0 m");
  });
});

describe("formatDistanceShort", () => {
  it("drops trailing zeros", () => {
    expect(formatDistanceShort(2000, "km")).toBe("2 km");
    expect(formatDistanceShort(2500, "km")).toBe("2.5 km");
    expect(formatDistanceShort(5000, "mi")).toBe("3.1 mi");
  });
});

describe("parseDistance", () => {
  it("converts to metres in the chosen units", () => {
    expect(parseDistance("3", "km")).toBe(3000);
    expect(parseDistance("2,5", "km")).toBe(2500);
    expect(parseDistance("1", "mi")).toBe(1609);
  });

  it("rejects empty, zero, negative and junk input", () => {
    for (const bad of ["", "0", "-2", "abc"]) expect(parseDistance(bad, "km")).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration("2026-10-07T10:00:00Z", "2026-10-07T10:12:20Z")).toBe("12 min");
    expect(formatDuration("2026-10-07T10:00:00Z", "2026-10-07T11:05:00Z")).toBe("1 h 05 min");
  });
});
