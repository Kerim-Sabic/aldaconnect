import { NextRequest, NextResponse } from "next/server";
import { GET as workspaceSnapshot } from "../../workspace/route";
import { productCode, readFoodProduct, type FoodProduct } from "@/lib/barcode";
export const runtime = "nodejs";
const cache = new Map<string, { products: FoodProduct[]; expires: number }>();
const limits = new Map<string, { count: number; reset: number }>();
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") || "").trim();
  if (query.length < 2 || query.length > 80)
    return reply({ error: "Unesite naziv ili brend od 2 do 80 znakova." }, 400);
  const snapshot = await workspaceSnapshot(req);
  if (!snapshot.ok)
    return reply({ error: "Prijavite se da pronađete proizvod." }, 401);
  const context = await snapshot.json();
  if (
    context.readOnly ||
    context.actor?.role !== "client" ||
    context.actor.id !== context.clientId
  )
    return reply({ error: "Otvorite svoj korisnički prostor." }, 403);
  const now = Date.now();
  for (const [key, value] of limits) if (value.reset < now) limits.delete(key);
  const member = limits.get(context.actor.id) || {
    count: 0,
    reset: now + 60000,
  };
  if (member.count >= 5)
    return reply({ error: "Sačekajte minutu prije nove pretrage." }, 429);
  member.count++;
  limits.set(context.actor.id, member);
  const key = query.toLocaleLowerCase();
  const existing = cache.get(key);
  if (existing && existing.expires > now)
    return reply({ products: existing.products });
  const provider = limits.get("provider") || { count: 0, reset: now + 60000 };
  if (provider.count >= 8)
    return reply(
      {
        error:
          "Pretraga je zauzeta. Pokušajte za minutu ili unesite deklaraciju.",
      },
      429,
    );
  provider.count++;
  limits.set("provider", provider);
  const staging = process.env.LOCAL_SYNTHETIC_TESTS === "true";
  const host = staging ? "world.openfoodfacts.net" : "world.openfoodfacts.org";
  const url = new URL(`https://${host}/cgi/search.pl`);
  url.search = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "16",
    fields:
      "code,product_name,product_name_bs,generic_name,brands,nutriments,serving_quantity,serving_quantity_unit",
  }).toString();
  const headers: Record<string, string> = {
    "User-Agent": "AldaConnect/1.1 (https://aldaconnect.vercel.app)",
    Accept: "application/json",
  };
  if (staging)
    headers.Authorization =
      "Basic " + Buffer.from("off:off").toString("base64");
  try {
    const legacySearch = async () => {
      const response = await fetch(url, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw Error("Catalog unavailable");
      const raw = await response.json();
      if (!Array.isArray(raw.products)) throw Error("Invalid catalog response");
      return raw.products as Record<string, unknown>[];
    };
    let matches: Record<string, unknown>[];
    if (staging) matches = await legacySearch();
    else {
      try {
        const response = await fetch(
          "https://search.openfoodfacts.org/search",
          {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            cache: "no-store",
            signal: AbortSignal.timeout(4000),
            body: JSON.stringify({
              q: query,
              page_size: 16,
              fields: [
                "code",
                "product_name",
                "product_name_bs",
                "generic_name",
                "brands",
                "nutriments",
                "serving_quantity",
                "serving_quantity_unit",
              ],
            }),
          },
        );
        if (!response.ok) throw Error("Search unavailable");
        const raw = await response.json();
        if (!Array.isArray(raw.hits)) throw Error("Invalid search response");
        matches = raw.hits;
      } catch {
        matches = await legacySearch();
      }
    }
    const products: FoodProduct[] = matches.flatMap(
      (p: Record<string, unknown>) => {
        const code = productCode(String(p.code || ""));
        const product = code
          ? readFoodProduct(code, { status: 1, product: p })
          : null;
        return product ? [product] : [];
      },
    );
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { products, expires: now + 900000 });
    return reply({ products });
  } catch {
    return reply(
      {
        error:
          "Pretraga trenutno nije dostupna. Skenirajte barkod ili unesite podatke s deklaracije.",
      },
      502,
    );
  }
}
