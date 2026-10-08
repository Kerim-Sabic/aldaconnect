import { z } from "zod";
const date = z
  .union([z.literal(""), z.iso.date().refine((v) => v >= "1900-01-01")])
  .nullable();
export const medicationContent = z
  .object({
    category: z.enum(["medication", "supplement", "ped"]),
    name: z.string().trim().min(1).max(120),
    dose: z.string().trim().max(120),
    route: z.string().trim().max(80),
    frequency: z.string().trim().max(120),
    timing: z.string().trim().max(300),
    note: z.string().trim().max(1000),
    status: z.enum(["active", "paused", "stopped"]),
    start: date,
    end: date,
  })
  .refine((v) => !v.start || !v.end || v.end >= v.start, "Provjerite datume.");
export const medicationSave = z.object({
  id: z.uuid(),
  version: z.number().int().min(0),
  clientId: z.string().max(80).optional(),
  content: medicationContent,
});
export type MedicationContent = z.infer<typeof medicationContent>;
export type MedicationRecord = {
  id: string;
  client_id: string;
  content: MedicationContent;
  version: number;
  created_by: string;
  created_name: string;
  created_at: string;
  updated_name: string;
  updated_at: string;
  removed_at: string | null;
};
export type MedicationVersion = {
  record_id: string;
  version: number;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  content: MedicationContent;
  removed_at: string | null;
  created_at: string;
};
export type MedicationData = {
  actor: { id: string; name: string; role: string };
  clientId: string | null;
  allowed: boolean;
  clients: { id: string; name: string }[];
  team: { id: string; name: string; role: string; granted: boolean }[];
  entries: MedicationRecord[];
  history: MedicationVersion[];
};
export const categoryLabels = {
  medication: "Lijek",
  supplement: "Suplement",
  ped: "PED",
};
export const statusLabels = {
  active: "Aktivno",
  paused: "Pauzirano",
  stopped: "Završeno",
};
export const recordLabels: Record<keyof MedicationContent, string> = {
  category: "Vrsta",
  name: "Naziv",
  dose: "Zabilježena doza",
  route: "Način primjene",
  frequency: "Učestalost",
  timing: "Vrijeme / raspored",
  note: "Bilješka",
  status: "Status",
  start: "Početak",
  end: "Završetak",
};
