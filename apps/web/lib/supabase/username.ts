import { cookies } from "next/headers";
import { supabaseServer } from "./server";
export const usernameCookie = "fitness_username_session";
export async function usernameToken() {
  return (await cookies()).get(usernameCookie)?.value;
}
export async function usernameCall(
  action: string,
  payload: Record<string, unknown> = {},
  client: string | null = null,
  preview: string | null = null,
) {
  const sb = await supabaseServer();
  return sb.rpc("username_workspace", {
    p_token: (await usernameToken()) ?? "",
    p_action: action,
    p_payload: payload,
    p_client_id: client,
    p_preview: preview,
  });
}
