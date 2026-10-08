import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { database, getActor } from "@/lib/db";
import { cycleEntrySchema } from "@/lib/cycle";
import { cloudConfigured, supabaseServer } from "@/lib/supabase/server";
import { usernameToken } from "@/lib/supabase/username";
export const runtime = "nodejs";
const reply = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
async function dispatch(
  req: NextRequest,
  action: string,
  payload: Record<string, unknown>,
) {
  if (cloudConfigured() && process.env.LOCAL_SYNTHETIC_TESTS !== "true") {
    const sb = await supabaseServer();
    const token = await usernameToken();
    if (!token) {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return reply({ error: "Prijavite se da nastavite." }, 401);
    }
    const { data, error } = token
      ? await sb.rpc("username_cycle", {
          p_token: token,
          p_action: action,
          p_payload: payload,
        })
      : await sb.rpc("cycle_action", { p_action: action, p_payload: payload });
    return error
      ? reply(
          {
            error: error.message.startsWith("APP:")
              ? error.message.slice(4)
              : "Nije moguće sačuvati dnevnik.",
          },
          400,
        )
      : reply(data);
  }
  if (
    process.env.LOCAL_DEVELOPMENT !== "true" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(req.nextUrl.hostname)
  )
    return reply({ error: "Lokalni razvoj je isključen." }, 503);
  const db = await database();
  const actor = await getActor(
    db,
    (await cookies()).get("fitness_local_session")?.value ?? "",
  );
  if (!actor) return reply({ error: "Prijavite se da nastavite." }, 401);
  if (actor.role !== "client")
    return reply({ error: "Ovo je privatni dnevnik vlasnika računa." }, 403);
  const { rows } = await db.query<{ cycle_dispatch: unknown }>(
    "select app_private.cycle_dispatch($1,$2,$3)",
    [actor.id, action, JSON.stringify(payload)],
  );
  return reply(rows[0].cycle_dispatch);
}
export async function GET(req: NextRequest) {
  try {
    return await dispatch(req, "snapshot", {});
  } catch {
    return reply({ error: "Dnevnik trenutno nije dostupan." }, 500);
  }
}
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== req.headers.get("host"))
      return reply({ error: "Zahtjev nije dozvoljen." }, 403);
    if (!req.headers.get("content-type")?.includes("application/json"))
      return reply({ error: "Neispravan format zahtjeva." }, 415);
    const raw = await req.text();
    if (raw.length > 5000) return reply({ error: "Zahtjev je prevelik." }, 413);
    const body = z
      .object({
        action: z.enum(["save", "remove", "restore"]),
        payload: z.record(z.string(), z.unknown()),
      })
      .parse(JSON.parse(raw));
    const payload =
      body.action === "save"
        ? cycleEntrySchema.parse(body.payload)
        : z.object({ id: z.uuid() }).parse(body.payload);
    return await dispatch(req, body.action, payload);
  } catch {
    return reply(
      { error: "Provjerite unos, datum i pristup. Promjene nisu sačuvane." },
      400,
    );
  }
}
