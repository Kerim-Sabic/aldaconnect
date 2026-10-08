import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { usernameCookie } from "@/lib/supabase/username";
export async function POST(req: NextRequest) {
  const reply = (body: unknown, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== req.headers.get("host"))
    return reply({ error: "Zahtjev nije dozvoljen." }, 403);
  try {
    const text = await req.text();
    if (text.length > 2000)
      return reply({ error: "Zahtjev je prevelik." }, 413);
    const { token_hash, type } = z
      .object({
        token_hash: z.string().regex(/^[a-f0-9]{64}$/i),
        type: z.enum(["signup", "recovery", "invite", "email_change"]),
      })
      .parse(JSON.parse(text));
    const sb = await supabaseServer();
    const { error } = await sb.auth.verifyOtp({ token_hash, type });
    if (error)
      return reply(
        {
          error:
            "Link je istekao ili je već iskorišten. Zatražite novu poruku.",
        },
        400,
      );
    (await cookies()).delete(usernameCookie);
    return reply({ ok: true, next: type === "recovery" || type === "invite" ? "/auth/reset" : "/" });
  } catch {
    return reply({ error: "Link nije ispravan. Zatražite novu poruku." }, 400);
  }
}
