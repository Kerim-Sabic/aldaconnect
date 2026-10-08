import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { usernameToken } from "@/lib/supabase/username";
import { labError } from "@/lib/lab-server";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== req.headers.get("host"))
      return NextResponse.json(
        { error: "Zahtjev nije dozvoljen." },
        { status: 403 },
      );
    const token = await usernameToken();
    if (!token)
      return NextResponse.json(
        { error: "Prijavite se kao administrator." },
        { status: 401 },
      );
    const raw = await req.text();
    if (raw.length > 2000) throw Error("APP:Zahtjev je prevelik.");
    const body = z
      .object({
        username: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,39}$/),
        password: z.string().min(4).max(128),
        name: z.string().trim().min(2).max(70),
        clientId: z.uuid(),
      })
      .parse(JSON.parse(raw));
    const { data, error } = await (
      await supabaseServer()
    ).rpc("admin_test_doctor", {
      p_token: token,
      p_username: body.username,
      p_password: body.password,
      p_name: body.name,
      p_client_id: body.clientId,
    });
    if (error) throw Error(error.message);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: labError(e) },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
