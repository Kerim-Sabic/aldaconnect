import { z } from "zod";

export type DiaryEntry = {
  id: string;
  kind: string;
  label: string;
  value: number | null;
  created_at: string;
};
export const diaryInput = z.object({
  kind: z.enum(["meal", "water", "sleep", "energy", "measurement"]),
  label: z.string().trim().min(1).max(200),
  value: z.number().finite().min(0).max(10000).optional(),
});
// Dates follow the device's local day, including when the app is installed.
export function dayKey(value: string | Date = new Date()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function nutritionTotals(entries: DiaryEntry[], day: string) {
  const items = entries.filter((entry) => dayKey(entry.created_at) === day);
  const meals = items.filter((entry) => entry.kind === "meal");
  return {
    meals,
    calories: meals.reduce((sum, entry) => sum + Number(entry.value ?? 0), 0),
    uncounted: meals.filter((entry) => entry.value === null).length,
    water: items
      .filter((entry) => entry.kind === "water")
      .reduce((sum, entry) => sum + Number(entry.value ?? 0), 0),
  };
}
