import { redirect } from "next/navigation";
import Landing from "@/components/landing";
import "./landing.css";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.invite || params.auth) {
    const query = new URLSearchParams();
    for (const key of ["invite", "auth"])
      if (typeof params[key] === "string") query.set(key, params[key]);
    redirect("/app?" + query);
  }
  return <Landing />;
}
