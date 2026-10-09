import { it, expect, vi, afterEach } from "vitest";
import { saveFood, savedFoods } from "../apps/web/lib/saved-foods";
afterEach(() => vi.unstubAllGlobals());
it("keeps custom labels scoped to the account and validates stored values", () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  const food = {
    code: "3017620422003",
    name: "My label",
    brand: "",
    caloriesPer100: 123,
    unit: "g" as const,
    serving: null,
    source: "device",
  };
  saveFood("one", food);
  expect(savedFoods("one")).toHaveLength(1);
  expect(savedFoods("two")).toHaveLength(0);
  saveFood("one", { ...food, caloriesPer100: 234 });
  expect(savedFoods("one")).toHaveLength(1);
  expect(savedFoods("one")[0].caloriesPer100).toBe(234);
  expect(() => saveFood("one", { ...food, caloriesPer100: NaN })).toThrow();
  storage.set("alda-food-products-v1:bad", '{"unexpected":true}');
  expect(savedFoods("bad")).toEqual([]);
});
