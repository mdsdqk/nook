import { describe, expect, test } from "bun:test";
import { normalizeProfileUpdate } from "../profile";

describe("normalizeProfileUpdate", () => {
  test("trims name and leaves username unchanged when omitted", () => {
    expect(normalizeProfileUpdate({ name: "  Ada  " })).toEqual({
      name: "Ada",
      username: { kind: "unchanged" },
    });
  });

  test("rejects empty name", () => {
    expect(() => normalizeProfileUpdate({ name: "   " })).toThrow(
      "Name is required",
    );
  });

  test("rejects oversized name", () => {
    expect(() =>
      normalizeProfileUpdate({ name: "x".repeat(101) }),
    ).toThrow("Name must be less than 100 characters");
  });

  test("normalizes username to lowercase", () => {
    expect(
      normalizeProfileUpdate({ name: "Ada", username: "Ada_Lovelace" }),
    ).toEqual({
      name: "Ada",
      username: { kind: "set", username: "ada_lovelace" },
    });
  });

  test("rejects short username", () => {
    expect(() =>
      normalizeProfileUpdate({ name: "Ada", username: "ab" }),
    ).toThrow("Username must be at least 3 characters");
  });

  test("rejects invalid username characters", () => {
    expect(() =>
      normalizeProfileUpdate({ name: "Ada", username: "ada-lovelace" }),
    ).toThrow("Username may only contain letters, numbers, and underscores");
  });

  test("rejects clearing username when required", () => {
    expect(() =>
      normalizeProfileUpdate({
        name: "Ada",
        username: "",
        usernameRequired: true,
      }),
    ).toThrow("Username is required");
  });

  test("allows clear via empty string when not required", () => {
    expect(
      normalizeProfileUpdate({ name: "Ada", username: "  " }),
    ).toEqual({
      name: "Ada",
      username: { kind: "clear" },
    });
  });

  test("allows clear via null even when usernameRequired", () => {
    expect(
      normalizeProfileUpdate({
        name: "Ada",
        username: null,
        usernameRequired: true,
      }),
    ).toEqual({
      name: "Ada",
      username: { kind: "clear" },
    });
  });
});
