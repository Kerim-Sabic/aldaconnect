import { z } from "zod";
import { sarajevoDay } from "./cycle";
export const labUpload = z.object({
  id: z.uuid(),
  clientId: z.string().max(80).optional(),
  title: z.string().trim().min(1).max(120),
  provider: z.string().trim().min(1).max(120),
  date: z.iso.date().refine((v) => v >= "1900-01-01" && v <= sarajevoDay()),
});
export const labReview = z.object({
  id: z.uuid(),
  reviewId: z.uuid(),
  clientId: z.string().max(80).optional(),
  note: z.string().trim().min(1).max(2000),
  decision: z.enum(["reviewed", "followUp"]),
});
export type LabDocument = {
  id: string;
  title: string;
  provider: string;
  report_date: string;
  is_test: true;
  uploaded_name: string;
  file_size: number;
  created_at: string;
  removed_at: string | null;
};
export type LabReview = {
  id: string;
  document_id: string;
  doctor_name: string;
  note: string;
  decision: "reviewed" | "followUp";
  created_at: string;
};
export type LabData = {
  actor: { id: string; name: string; role: string };
  clientId: string | null;
  allowed: boolean;
  clients: { id: string; name: string }[];
  team: { id: string; name: string; granted: boolean }[];
  documents: LabDocument[];
  reviews: LabReview[];
};
export function validateLabPdf(bytes: Uint8Array) {
  const text = Buffer.from(bytes).toString("latin1");
  return (
    bytes.length <= 2097152 &&
    text.startsWith("%PDF-") &&
    text.slice(-1024).includes("%%EOF") &&
    !/\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction)\b/.test(text)
  );
}
