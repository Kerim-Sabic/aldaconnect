import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { productCode } from "@/lib/barcode";
import {
  foodCatalog,
  catalogStatus,
  catalogMessage,
} from "@/lib/supabase/food-catalog";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
const quantity = z.number().finite().min(0).max(100);
const declaration = z
  .object({
    name: z.string().trim().min(2).max(160),
    brand: z.string().trim().max(80),
    unit: z.enum(["g", "ml"]),
    caloriesPer100: z.number().finite().min(0).max(1000),
    protein: quantity,
    carbs: quantity,
    fat: quantity,
    sugars: quantity.nullable().optional(),
    fiber: quantity.nullable().optional(),
    saturated: quantity.nullable().optional(),
    salt: quantity.nullable().optional(),
    serving: z.number().finite().positive().max(5000).nullable(),
    packageQuantity: z
      .number()
      .finite()
      .positive()
      .max(100000)
      .nullable()
      .optional(),
    ingredients: z.string().max(1000),
    allergens: z.string().max(300),
    description: z.string().max(500),
  })
  .strict();
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    if (code && !productCode(code))
      return reply({ error: "Unesite ispravan barkod." }, 400);
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length > 80)
      return reply({ error: "Pretraga može imati najviše 80 znakova." }, 400);
    const { data, error } = await foodCatalog(
      code ? "lookup" : "list",
      code
        ? { code }
        : { q, mine: req.nextUrl.searchParams.get("mine") === "true" },
    );
    return error
      ? reply(
          { error: catalogMessage(error.message) },
          catalogStatus(error.code),
        )
      : reply(
          code
            ? { product: data?.product ?? null }
            : { products: data?.products ?? [] },
        );
  } catch {
    return reply({ error: "Katalog trenutno nije dostupan." }, 503);
  }
}
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host"))
      return reply({ error: "Nedozvoljena adresa zahtjeva." }, 403);
    if (!req.headers.get("content-type")?.includes("application/json"))
      return reply({ error: "Koristite JSON format." }, 415);
    const raw = await req.text();
    if (raw.length > 9000) return reply({ error: "Zahtjev je prevelik." }, 413);
    const input = z
      .object({
        action: z.enum(["save", "report", "moderate"]),
        code: z.string().refine((v) => Boolean(productCode(v))),
        product: declaration.optional(),
        version: z.number().int().positive().optional(),
        reason: z.string().trim().min(3).max(300).optional(),
        hidden: z.boolean().optional(),
      })
      .strict()
      .parse(JSON.parse(raw));
    if (input.action === "save" && !input.product)
      return reply({ error: "Unesite podatke s deklaracije." }, 400);
    if (input.action === "report" && !input.reason)
      return reply({ error: "Opišite grešku." }, 400);
    const { action, ...payload } = input;
    const { data, error } = await foodCatalog(action, payload);
    return error
      ? reply(
          { error: catalogMessage(error.message) },
          catalogStatus(error.code),
        )
      : reply({ ok: true, product: data?.product });
  } catch {
    return reply(
      { error: "Provjerite barkod i vrijednosti s deklaracije." },
      400,
    );
  }
}
