import { z } from "zod";
export const cycleSymptoms = [
  "cramps",
  "headache",
  "fatigue",
  "bloating",
  "breastTenderness",
  "sleepChange",
  "moodChange",
  "other",
] as const;
export const cycleLabels: Record<string, string> = {
  cramps: "Grčevi",
  headache: "Glavobolja",
  fatigue: "Umor",
  bloating: "Nadutost",
  breastTenderness: "Osjetljivost dojki",
  sleepChange: "Promjena sna",
  moodChange: "Promjena raspoloženja",
  other: "Drugo",
};
export function sarajevoDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sarajevo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export const cycleEntrySchema = z.object({
  id: z.uuid(),
  date: z.iso
    .date()
    .refine(
      (v) => v >= "1900-01-01" && v <= sarajevoDay(),
      "Provjerite datum.",
    ),
  bleeding: z.enum(["none", "spotting", "light", "moderate", "heavy"]),
  pain: z.number().int().min(0).max(10).nullable(),
  symptoms: z
    .array(z.enum(cycleSymptoms))
    .max(8)
    .transform((v) => [...new Set(v)]),
  note: z.string().trim().max(1000),
});
export type CycleEntry = z.infer<typeof cycleEntrySchema> & {
  updated_at?: string;
  removed_at?: string | null;
};
export const bleedingLabels: Record<string, string> = {
  none: "Bez krvarenja",
  spotting: "Tačkasto",
  light: "Blago",
  moderate: "Umjereno",
  heavy: "Obilno",
};
