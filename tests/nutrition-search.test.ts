import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { NextRequest } from "../apps/web/node_modules/next/server";
const { snapshot } = vi.hoisted(() => ({ snapshot: vi.fn() }));
vi.mock("../apps/web/app/api/workspace/route", () => ({ GET: snapshot }));
let GET: typeof import("../apps/web/app/api/nutrition/search/route").GET;
const request = (q = "jogurt") =>
  new NextRequest(
    "http://localhost:4310/api/nutrition/search?q=" + encodeURIComponent(q),
  );
beforeEach(async () => {
  vi.resetModules();
  ({ GET } = await import("../apps/web/app/api/nutrition/search/route"));
  snapshot.mockImplementation(async () =>
    Response.json({
      actor: { id: "member", role: "client" },
      clientId: "member",
    }),
  );
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("validates the query before contacting the catalog", async () => {
  expect((await GET(request("x"))).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
it("requires the client own context, including for search", async () => {
  snapshot.mockResolvedValue(Response.json({}, { status: 401 }));
  expect((await GET(request())).status).toBe(401);
  snapshot.mockResolvedValue(
    Response.json({
      actor: { id: "owner", role: "admin" },
      clientId: "member",
    }),
  );
  expect((await GET(request())).status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});
it("returns only products with valid codes and declared energy", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      hits: [
        {
          code: "3017620422003",
          product_name: "Product",
          nutriments: { "energy-kcal_100g": 539 },
        },
        {
          code: "3017620422004",
          product_name: "Bad checksum",
          nutriments: { "energy-kcal_100g": 539 },
        },
        { code: "5449000000996", product_name: "No energy" },
      ],
    }),
  );
  const res = await GET(request());
  expect(res.headers.get("cache-control")).toContain("no-store");
  expect((await res.json()).products).toHaveLength(1);
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(
    "search.openfoodfacts.org",
  );
  await GET(request());
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("keeps provider failures recoverable", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("Down", { status: 503 }));
  expect((await GET(request())).status).toBe(502);
});

it("falls back to legacy full-text search when the dedicated index is unavailable", async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
    .mockResolvedValueOnce(
      Response.json({
        products: [
          {
            code: "3017620422003",
            product_name: "Product",
            nutriments: { "energy-kcal_100g": 539 },
          },
        ],
      }),
    );
  const res = await GET(request());
  expect(res.status).toBe(200);
  expect((await res.json()).products).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain("cgi/search.pl");
});
