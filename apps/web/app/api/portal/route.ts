import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { usernameToken } from "@/lib/supabase/username";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
async function call(action: string, payload: Record<string, unknown>) {
  const sb = await supabaseServer();
  const token = await usernameToken();
  if (!token) {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return reply({ error: "Prijavite se da nastavite." }, 401);
  }
  const { data, error } = await sb.rpc("portal_workspace", {
    p_token: token || null,
    p_action: action,
    p_payload: payload,
  });
  if (error)
    return reply(
      {
        error: error.message.startsWith("APP:")
          ? error.message.slice(4)
          : "Nije moguće završiti radnju. Provjerite unesene podatke.",
      },
      400,
    );
  return reply(data);
}
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("scope") === "messages")
    return call("messages", {});
  return call(
    "snapshot",
    req.nextUrl.searchParams.has("group")
      ? { groupId: req.nextUrl.searchParams.get("group") }
      : {},
  );
}
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return reply({ error: "Zahtjev nije dozvoljen." }, 403);
  if (!req.headers.get("content-type")?.includes("application/json"))
    return reply({ error: "Zahtjev mora biti u JSON formatu." }, 415);
  try {
    const text = await req.text();
    if (text.length > 16000)
      return reply({ error: "Zahtjev je prevelik." }, 413);
    const { action, payload } = z
      .object({
        action: z.enum([
          "createGroup",
          "inviteGroup",
          "respondInvite",
          "leaveGroup",
          "groupMessage",
          "ownerMessage",
          "ownerPlan",
          "ownerReview",
        ]),
        payload: z.record(z.string(), z.unknown()),
      })
      .parse(JSON.parse(text));
    if (["groupMessage", "ownerMessage"].includes(action))
      payload.text = z.string().trim().min(1).max(2000).parse(payload.text);
    if (action === "createGroup")
      payload.name = z.string().trim().min(2).max(80).parse(payload.name);
    return call(action, payload);
  } catch {
    return reply({ error: "Provjerite unesene podatke." }, 400);
  }
}
