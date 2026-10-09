import catalog from "./program-catalog.json";
import { type Exercise } from "./domain";
export type Program = (typeof catalog)[number];
export const programs: Program[] = catalog;
export const programCategories: Record<string, string> = {
  all: "Sve",
  training: "Trening",
  nutrition: "Ishrana",
  supplements: "Suplementi",
};
export function programExercises(
  program: Program,
  dayIndex: number,
): Exercise[] | null {
  const day = program.days[dayIndex];
  if (
    !day?.exercises.length ||
    day.exercises.length > 20 ||
    day.exercises.some((e) => !e.name || !e.prescription)
  )
    return null;
  return day.exercises.map((e, i) => ({
    id: `ref-${program.id.slice(0, 8)}-${dayIndex}-${i}`,
    name: e.name!.slice(0, 80),
    group: e.section,
    sets: Number(e.prescription.split("×")[0].trim()),
    reps: e.prescription
      .split("×")[1]
      .trim()
      .replace(
        /(\d+)(?:-(\d+))?\s*min\b/i,
        (_, low, high) =>
          `${Number(low) * 60}${high ? "-" + Number(high) * 60 : ""} sec`,
      )
      .replace(/(\d)\s*s\b/i, "$1 sec"),
    weight: 0,
    metric: /\d\s*(?:s|min|sec)\b/i.test(e.prescription) ? "seconds" : "reps",
    cue: e.rest
      ? `Odmor ${e.rest} sekundi. Prilagodite opterećenje s trenerom.`
      : "Prilagodite trajanje i opterećenje s trenerom.",
  }));
}
