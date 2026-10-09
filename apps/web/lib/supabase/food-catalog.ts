import { supabaseServer } from "./server";
import { usernameToken } from "./username";
import type { FoodProduct } from "@/lib/barcode";
export async function foodCatalog(
  action: string,
  payload: Record<string, unknown> = {},
) {
  const sb = await supabaseServer();
  const token = await usernameToken();
  if (!token) {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user)
      return {
        data: null,
        error: { message: "APP:Prijavite se da nastavite.", code: "28000" },
      };
  }
  return sb.rpc("food_catalog", {
    p_token: token ?? "",
    p_action: action,
    p_payload: payload,
  }) as unknown as Promise<{
    data: {
      actorId?: string;
      product?: FoodProduct | null;
      products?: FoodProduct[];
      ok?: boolean;
    } | null;
    error: { message: string; code: string } | null;
  }>;
}
export function catalogStatus(code: string) {
  return code === "28000"
    ? 401
    : code === "42501"
      ? 403
      : ["PT409", "40001", "23505"].includes(code)
        ? 409
        : code === "54000"
          ? 429
          : code === "22023"
            ? 400
            : 503;
}
export function catalogMessage(message: string) {
  return message.startsWith("APP:")
    ? message.slice(4)
    : "Katalog trenutno nije dostupan. Pokušajte ponovo.";
}
