import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          req.nextUrl.searchParams.get("next") === "/auth/reset"
            ? "/auth/reset"
            : "/",
          req.url,
        ),
      );
  }
  return NextResponse.redirect(new URL("/?auth=confirmation-failed", req.url));
}
