import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { database, getActor } from "./db";
import { cloudConfigured, supabaseServer } from "./supabase/server";
import { usernameToken } from "./supabase/username";
export async function labCall(
  req: NextRequest,
  action: string,
  payload: Record<string, unknown>,
) {
  if (cloudConfigured() && process.env.LOCAL_SYNTHETIC_TESTS !== "true") {
    const sb = await supabaseServer(),
      token = await usernameToken();
    if (!token) {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw Error("APP:Prijavite se da nastavite.");
    }
    const { data, error } = token
      ? await sb.rpc("username_labs", {
          p_token: token,
          p_action: action,
          p_payload: payload,
        })
      : await sb.rpc("labs_action", { p_action: action, p_payload: payload });
    if (error) throw Error(error.message);
    return data;
  }
  if (
    process.env.LOCAL_DEVELOPMENT !== "true" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(req.nextUrl.hostname)
  )
    throw Error("APP:Lokalni razvoj je isključen.");
  const db = await database(),
    actor = await getActor(
      db,
      (await cookies()).get("fitness_local_session")?.value ?? "",
    );
  if (!actor) throw Error("APP:Prijavite se da nastavite.");
  return (
    await db.query<{ value: unknown }>(
      "select app_private.labs_dispatch($1,$2,$3) as value",
      [actor.id, action, JSON.stringify(payload)],
    )
  ).rows[0].value;
}
export function labError(e: unknown) {
  return e instanceof Error && e.message.startsWith("APP:")
    ? e.message.slice(4)
    : "Zahtjev nije završen. Provjerite datoteku, unos i pristup.";
}
