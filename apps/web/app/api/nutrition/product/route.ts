import { NextRequest, NextResponse } from "next/server";
import { GET as workspaceSnapshot } from "../../workspace/route";
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
    const snapshot = await workspaceSnapshot(req);
    if (!snapshot.ok)
      return reply({ error: "Prijavite se da pronađete proizvod." }, 401);
    const data = await snapshot.json();
    if (
      data.readOnly ||
      data.actor?.role !== "client" ||
      data.actor.id !== data.clientId
    )
      return reply({ error: "Otvorite svoj korisnički prostor." }, 403);
    const now = Date.now();
    for (const [id, limit] of usage) if (limit.reset < now) usage.delete(id);
    const limit = usage.get(data.actor.id) ?? { count: 0, reset: now + 60000 };
    if (limit.count >= 10)
      return reply(
        { error: "Sačekajte minutu prije novog pretraživanja." },
        429,
      );
    limit.count++;
    usage.set(data.actor.id, limit);
    const cached = cache.get(code);
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
    for (const variant of productCodeVariants(code)) {
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
        `https://${host}/api/v3.6/product/${variant}.json?fields=product_name,product_name_bs,generic_name,brands,nutrition,nutriments,serving_quantity,serving_quantity_unit,serving_size,quantity`,
        { headers, signal: AbortSignal.timeout(12000), cache: "no-store" },
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
    cache.set(code, { product, expires: now + 3600000 });
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
