import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "../apps/web/node_modules/next/server";
const { snapshot } = vi.hoisted(() => ({ snapshot: vi.fn() }));
vi.mock("../apps/web/app/api/workspace/route", () => ({ GET: snapshot }));
let GET: typeof import("../apps/web/app/api/nutrition/product/route").GET;
const request = (code = "3017620422003") =>
  new NextRequest(
    `http://localhost:4310/api/nutrition/product?code=${encodeURIComponent(code)}`,
  );
const providerProduct = {
  status: "success",
  product: {
    product_name: "Nutella",
    brands: "Ferrero",
    nutrition: {
      aggregated_set: {
        per: "100g",
        preparation: "as_sold",
        nutrients: {
          "energy-kcal": { value: 539, unit: "kcal", source: "manufacturer" },
        },
      },
    },
  },
};
beforeEach(async () => {
  vi.resetModules();
  ({ GET } = await import("../apps/web/app/api/nutrition/product/route"));
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
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("rejects invalid codes without querying the provider", async () => {
  expect((await GET(request("https://evil.test"))).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
it("requires an authenticated member", async () => {
  snapshot.mockResolvedValue(Response.json({}, { status: 401 }));
  expect((await GET(request())).status).toBe(401);
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects experts, previews and other member contexts", async () => {
  for (const data of [
    { actor: { id: "coach", role: "trainer" }, clientId: "member" },
    {
      actor: { id: "member", role: "client" },
      clientId: "member",
      readOnly: true,
    },
    { actor: { id: "member", role: "client" }, clientId: "other" },
  ]) {
    snapshot.mockResolvedValue(Response.json(data));
    expect((await GET(request())).status).toBe(403);
  }
  expect(fetch).not.toHaveBeenCalled();
});
it("returns nutrition and caches public products only", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json(providerProduct));
  const response = await GET(request());
  expect((await response.json()).caloriesPer100).toBe(539);
  expect(response.headers.get("cache-control")).toContain("no-store");
  await GET(request());
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("handles missing nutrition without inventing values", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ status: "success", product: { product_name: "Unknown" } }),
  );
  const response = await GET(request());
  expect(response.status).toBe(404);
  expect(await response.json()).not.toHaveProperty("caloriesPer100");
});
it("keeps a manual fallback after lookup failure", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("Down", { status: 503 }));
  expect((await GET(request())).status).toBe(502);
});
it("limits repeated lookups and uses a fixed provider host", async () => {
  vi.stubEnv("LOCAL_SYNTHETIC_TESTS", "false");
  vi.mocked(fetch).mockResolvedValue(Response.json(providerProduct));
  for (let i = 0; i < 10; i++) await GET(request());
  expect((await GET(request())).status).toBe(429);
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(
    "https://world.openfoodfacts.org/api/v3.6/product/3017620422003",
  );
});
