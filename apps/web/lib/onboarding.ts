import { z } from "zod";
export const onboardingIntake = z.object({
  goal: z.string().min(1).max(100),
  days: z.number().int().min(1).max(7),
  setting: z.string().min(1).max(60),
  experience: z.string().max(60).optional(),
  minutes: z.number().int().min(10).max(180).optional(),
  nutrition: z.string().max(120).optional(),
  sleepTarget: z.number().min(4).max(12).optional(),
  support: z.string().max(120).optional(),
  requestedModules: z.array(z.string().max(30)).max(20).optional(),
  schemaVersion: z.number().int().min(1).max(2).optional(),
});
