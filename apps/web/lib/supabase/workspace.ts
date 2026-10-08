import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "./server";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function cloudGet(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return reply({ error: "Prijavite se da nastavite." }, 401);
  const { data, error } = await sb.rpc("workspace_snapshot", {
    p_client_id: req.nextUrl.searchParams.get("client") ?? null,
  });
  if (error)
    return reply(
      { error: "Nije moguće učitati prostor. Provjerite svoj pristup." },
      403,
    );
  return reply(data);
}
export async function cloudPost(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return reply({ error: "Zahtjev dolazi s nedozvoljene adrese." }, 403);
  if (!req.headers.get("content-type")?.includes("application/json"))
    return reply({ error: "Zahtjev mora biti u JSON formatu." }, 415);
  try {
    const text = await req.text();
    if (text.length > 16000)
      return reply({ error: "Zahtjev je prevelik." }, 413);
    const { action, payload } = z
      .object({
        action: z.string(),
        payload: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(JSON.parse(text));
    const sb = await supabaseServer();
    if (action === "demo")
      return reply(
        {
          error: "Promjena izmišljenih profila dostupna je samo lokalno.",
        },
        403,
      );
    if (action === "register") {
      const name = z.string().trim().min(2).max(80).parse(payload.name);
      const email = z.email().parse(payload.email);
      const password = z.string().min(12).max(128).parse(payload.password);
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: new URL("/auth/callback", req.url).href,
        },
      });
      if (error)
        return reply(
          {
            error:
              "Nije moguće kreirati račun. Provjerite podatke ili pokušajte kasnije.",
          },
          400,
        );
      return reply({ ok: true, confirmationRequired: !data.session });
    }
    if (action === "login") {
      const { error } = await sb.auth.signInWithPassword({
        email: z.email().parse(payload.email),
        password: z.string().min(1).max(128).parse(payload.password),
      });
      return error
        ? reply({ error: "E-pošta ili lozinka nisu ispravni." }, 401)
        : reply({ ok: true });
    }
    if (action === "logout") {
      await sb.auth.signOut();
      return reply({ ok: true });
    }
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user)
      return reply(
        { error: "Vaša sesija je istekla. Prijavite se ponovo." },
        401,
      );
    const { data, error } = await sb.rpc("workspace_action", {
      p_action: action,
      p_payload: payload,
    });
    return error
      ? reply(
          {
            error: error.message.startsWith("APP:")
              ? error.message.slice(4)
              : "Nije moguće sačuvati. Provjerite pristup i unesene podatke.",
          },
          400,
        )
      : reply(data ?? { ok: true });
  } catch {
    return reply(
      { error: "Provjerite unesene podatke i pokušajte ponovo." },
      400,
    );
  }
}
