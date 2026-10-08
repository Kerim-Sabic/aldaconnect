import { NextResponse } from "next/server";
import { cloudConfigured } from "@/lib/supabase/server";
export function GET() {
  return NextResponse.json(
    {
      cloud: cloudConfigured() && process.env.LOCAL_SYNTHETIC_TESTS !== "true",
      environment:
        cloudConfigured() && process.env.LOCAL_SYNTHETIC_TESTS !== "true"
          ? "supabase-development"
          : "local-synthetic",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
