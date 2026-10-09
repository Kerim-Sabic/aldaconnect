import { it, expect } from "vitest";
import { programs, programExercises } from "../apps/web/lib/programs";
it("imports all 18 source programs with factual schedules and attribution", () => {
  expect(programs).toHaveLength(18);
  expect(new Set(programs.map((p) => p.id)).size).toBe(18);
  expect(
    programs.every(
      (p) =>
        p.author === "Aldin Rastoder" &&
        p.source.startsWith("https://active-guidance-pro.vercel.app/programs/"),
    ),
  ).toBe(true);
  const children = programs.find((p) =>
    p.title.startsWith("Ishrana za djecu"),
  )!;
  expect(children.days).toHaveLength(7);
  expect(children.days.flatMap((d) => d.meals)).toHaveLength(35);
  const keto = programs.find((p) => p.title.startsWith("Keto"))!;
  expect(keto.days[0].meals.reduce((s, m) => s + (m.calories || 0), 0)).toBe(
    2005,
  );
  expect(
    programs.find((p) => p.title.startsWith("Kućni program"))!.days,
  ).toHaveLength(2);
});
it("does not assign incomplete source content or turn supplement lists into workouts", () => {
  for (const p of programs) {
    if (p.category !== "training" || !p.days.length)
      expect(programExercises(p, 0)).toBeNull();
    p.days.forEach((d, i) => {
      if (d.exercises.some((e) => !e.name))
        expect(programExercises(p, i)).toBeNull();
    });
  }
  const back = programs.find((p) => p.title.startsWith("Aktivacija/jačanje"))!;
  expect(programExercises(back, 0)).toHaveLength(8);
  expect(
    programExercises(back, 0)?.every((e) => e.weight === 0 && e.sets === 3),
  ).toBe(true);
});

it("converts timed prescriptions to seconds before workout assignment", () => {
  const timed = programs
    .flatMap((p) => p.days.flatMap((_, i) => programExercises(p, i) || []))
    .filter((e) => e.metric === "seconds");
  expect(timed.length).toBeGreaterThan(0);
  expect(timed.every((e) => !/min|\ds$/.test(e.reps))).toBe(true);
  expect(timed.some((e) => e.reps === "20 sec")).toBe(true);
});

it("gives every program its own generated, local cover", () => {
  expect(new Set(programs.map((p) => p.image)).size).toBe(18);
  expect(
    programs.every((p) => /^\/programs\/program-\d{2}\.webp$/.test(p.image)),
  ).toBe(true);
});
