import { describe, it, expect } from "vitest";
import {
  effectiveModule,
  normalizeModules,
  validateSet,
} from "../apps/web/lib/domain";
describe("module access and performed work", () => {
  it("does not treat chosen as available or paid", () => {
    expect(effectiveModule(true, false, true)).toBe(false);
    expect(effectiveModule(true, true, false)).toBe(false);
    expect(effectiveModule(true, true, true)).toBe(true);
  });
  it("does not accept unknown/duplicate module identifiers", () =>
    expect(normalizeModules(["training", "training", "admin", "labs"])).toEqual(
      ["training", "labs"],
    ));
  it("rejects impossible or nonfinite set values", () => {
    expect(validateSet(50, 10)).toBe(true);
    for (const [weight, reps] of [
      [-1, 10],
      [Infinity, 5],
      [50, 0],
      [20, 1.5],
      [1001, 4],
    ])
      expect(validateSet(weight, reps)).toBe(false);
  });
});
