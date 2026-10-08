import { it, expect } from "vitest";
import { canAccessClient, type Actor } from "../apps/web/lib/domain";
const client: Actor = {
  id: "a",
  role: "client",
  name: "Test",
  email: "a@example.test",
  onboarded: true,
};
it("clients cannot read a different client even with a forged assignment list", () => {
  expect(canAccessClient(client, "a", [])).toBe(true);
  expect(canAccessClient(client, "b", ["b"])).toBe(false);
});
it("trainers require an active assigned client id", () => {
  expect(canAccessClient({ ...client, role: "trainer" }, "b", [])).toBe(false);
  expect(canAccessClient({ ...client, role: "trainer" }, "b", ["b"])).toBe(
    true,
  );
});
it("self-selected clinical roles do not inherit trainer permissions", () => {
  for (const role of ["doctor", "therapist", "nutritionist"] as const)
    expect(canAccessClient({ ...client, role }, "b", ["b"])).toBe(false);
});
