import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { usernameToken } from "@/lib/supabase/username";
import { labError } from "@/lib/lab-server";
export async function POST(req: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== req.headers.get("host"))
      return NextResponse.json(
        { error: "Zahtjev nije dozvoljen." },
        { status: 403, headers },
      );
    const token = await usernameToken();
    if (!token)
      return NextResponse.json(
        { error: "Prijavite se kao administrator." },
        { status: 401, headers },
      );
    const raw = await req.text();
    if (raw.length > 500) throw Error("APP:Zahtjev je prevelik.");
    const body = z
      .object({ password: z.string().min(5).max(128) })
      .strict()
      .parse(JSON.parse(raw));
    const { data, error } = await (
      await supabaseServer()
    ).rpc("admin_split_accounts", {
      p_token: token,
      p_password: body.password,
    });
    if (error) throw Error(error.message);
    return NextResponse.json(data, { headers });
  } catch (error) {
    return NextResponse.json(
      { error: labError(error) },
      { status: 400, headers },
    );
  }
}
