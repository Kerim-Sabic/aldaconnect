import { NextRequest, NextResponse } from "next/server";
import {
  foodCatalog,
  catalogMessage,
  catalogStatus,
} from "@/lib/supabase/food-catalog";
import {
  productCode,
  productCodeVariants,
  readFoodProduct,
  type FoodProduct,
} from "@/lib/barcode";
export const runtime = "nodejs";
const cache = new Map<string, { product: FoodProduct; expires: number }>();
const usage = new Map<string, { count: number; reset: number }>();
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET(req: NextRequest) {
  try {
    const code = productCode(req.nextUrl.searchParams.get("code") ?? "");
    if (!code)
      return reply(
        {
          error:
            "Unesite ispravan barkod s pakovanja (8, 12, 13 ili 14 cifara).",
        },
        400,
      );
    if (
      req.nextUrl.searchParams.has("preview") ||
      req.nextUrl.searchParams.has("client")
    )
      return reply({ error: "Otvorite svoj korisnički prostor." }, 403);
    const shared = await foodCatalog("lookup", { code });
    if (shared.error)
      return reply(
        { error: catalogMessage(shared.error.message) },
        catalogStatus(shared.error.code),
      );
    if (shared.data?.product) return reply(shared.data.product);
    const actorId = shared.data!.actorId!;
    const now = Date.now();
    for (const [id, limit] of usage) if (limit.reset < now) usage.delete(id);
    const limit = usage.get(actorId) ?? { count: 0, reset: now + 60000 };
    if (limit.count >= 10)
      return reply(
        { error: "Sačekajte minutu prije novog pretraživanja." },
        429,
      );
    limit.count++;
    usage.set(actorId, limit);
    const cached = cache.get(code.padStart(14, "0"));
    if (cached && cached.expires > now) return reply(cached.product);
    const staging = process.env.LOCAL_SYNTHETIC_TESTS === "true";
    const host = staging
      ? "world.openfoodfacts.net"
      : "world.openfoodfacts.org";
    const headers: Record<string, string> = {
      "User-Agent": "AldaConnect/1.0 (https://aldaconnect.vercel.app)",
      Accept: "application/json",
    };
    if (staging)
      headers.Authorization =
        "Basic " + Buffer.from("off:off").toString("base64");
    let product: FoodProduct | null = null;
    const deadline = AbortSignal.timeout(8000);
    for (const variant of productCodeVariants(code).sort(
      (a, b) => a.length - b.length,
    )) {
      const providerLimit = usage.get("provider") ?? {
        count: 0,
        reset: now + 60000,
      };
      if (providerLimit.count >= 14)
        return reply(
          {
            error:
              "Baza je trenutno zauzeta. Pokušajte za minutu ili unesite deklaraciju.",
          },
          429,
        );
      providerLimit.count++;
      usage.set("provider", providerLimit);
      const result = await fetch(
        `https://${host}/api/v3.6/product/${variant}.json?fields=product_name,product_name_bs,generic_name,brands,nutrition,nutriments,serving_quantity,serving_quantity_unit,serving_size,quantity,ingredients_text,allergens`,
        { headers, signal: deadline, cache: "no-store" },
      );
      if (result.status === 404) continue;
      if (!result.ok)
        return reply(
          {
            error:
              "Baza proizvoda trenutno nije dostupna. Pokušajte ponovo ili unesite deklaraciju.",
          },
          502,
        );
      product = readFoodProduct(variant, await result.json());
      if (product) break;
    }
    if (!product)
      return reply(
        {
          error:
            "Za ovaj barkod još nema potpunih kalorijskih podataka. Pronađite proizvod po nazivu ili sačuvajte deklaraciju za sljedeće skeniranje.",
        },
        404,
      );
    if (cache.size >= 500) cache.delete(cache.keys().next().value!);
    cache.set(code.padStart(14, "0"), { product, expires: now + 3600000 });
    return reply(product);
  } catch {
    return reply(
      {
        error:
          "Proizvod trenutno nije moguće učitati. Pokušajte ponovo ili unesite kalorije ručno.",
      },
      502,
    );
  }
}
