import { expect, it } from "vitest";
import {
  dayKey,
  diaryInput,
  nutritionTotals,
  type DiaryEntry,
} from "../apps/web/lib/nutrition";
const entry = (
  id: string,
  kind: string,
  value: number | null,
  date: string,
): DiaryEntry => ({ id, kind, value, label: id, created_at: date });
it("separates meal calories from water and previous days", () => {
  const totals = nutritionTotals(
    [
      entry("lunch", "meal", 450, "2026-10-09T12:00:00"),
      entry("water", "water", 250, "2026-10-09T12:00:00"),
      entry("old", "meal", 900, "2026-10-08T12:00:00"),
    ],
    "2026-10-09",
  );
  expect(totals.calories).toBe(450);
  expect(totals.water).toBe(250);
  expect(totals.meals).toHaveLength(1);
});
it("preserves legacy meals without inventing calories", () => {
  const totals = nutritionTotals(
    [
      entry("legacy", "meal", null, "2026-10-09T12:00:00"),
      entry("zero", "meal", 0, "2026-10-09T12:00:00"),
    ],
    "2026-10-09",
  );
  expect(totals.calories).toBe(0);
  expect(totals.uncounted).toBe(1);
  expect(totals.meals).toHaveLength(2);
});
it("uses local calendar dates at midnight boundaries", () => {
  expect(dayKey(new Date(2026, 9, 9, 0, 1))).toBe("2026-10-09");
  expect(dayKey(new Date(2026, 9, 8, 23, 59))).toBe("2026-10-08");
});
it("rejects unsafe calorie inputs", () => {
  for (const value of [-1, 10001, NaN, Infinity])
    expect(
      diaryInput.safeParse({ kind: "meal", label: "Lunch", value }).success,
    ).toBe(false);
  expect(
    diaryInput.parse({ kind: "meal", label: " Lunch ", value: 450 }).label,
  ).toBe("Lunch");
});
