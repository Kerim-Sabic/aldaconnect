import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "./server";
import { cookies } from "next/headers";
import { usernameCall, usernameCookie, usernameToken } from "./username";
import { onboardingIntake } from "@/lib/onboarding";
import { diaryInput } from "@/lib/nutrition";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function cloudGet(req: NextRequest) {
  if (await usernameToken()) {
    const { data, error } = await usernameCall(
      "snapshot",
      {},
      req.nextUrl.searchParams.get("client"),
      req.nextUrl.searchParams.get("preview"),
    );
    if (error)
      return reply(
        {
          error: error.message.startsWith("APP:")
            ? error.message.slice(4)
            : "Prijavite se ponovo.",
        },
        401,
      );
    return reply({
      sessions: [],
      preferences: { modules: [], intake: {}, version: 1 },
      clients: [],
      clientId: "",
      plans: [],
      logs: [],
      checkins: [],
      tasks: [],
      team: [],
      messages: [],
      diary: [],
      ...data,
    });
  }
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return reply({ error: "Prijavite se da nastavite." }, 401);
  const { data: profile } = await sb
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role === "admin") {
    const { data, error } = await sb.rpc("owner_snapshot", {
      p_preview: req.nextUrl.searchParams.get("preview") || null,
    });
    return error
      ? reply({ error: "Nije moguće učitati vlasnički prostor." }, 403)
      : reply(data);
  }
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
    if (action === "onboard")
      payload.intake = onboardingIntake.parse(payload.intake);
    if (action === "diary") Object.assign(payload, diaryInput.parse(payload));
    const sb = await supabaseServer();
    if (action === "recoverUsername") {
      const { data, error } = await sb.rpc("username_recover", {
        p_username: z.string().trim().min(3).max(40).parse(payload.username),
        p_recovery: z.string().trim().length(64).parse(payload.recoveryCode),
        p_password: z.string().min(12).max(128).parse(payload.password),
      });
      if (error || !data?.ok)
        return reply(
          { error: data?.error || "Oporavak računa trenutno nije dostupan." },
          400,
        );
      (await cookies()).delete(usernameCookie);
      await sb.auth.signOut();
      return reply(data);
    }
    if (
      action === "register" &&
      typeof payload.email === "string" &&
      !payload.email.includes("@")
    ) {
      const { data, error } = await sb.rpc("username_register", {
        p_name: z.string().trim().min(2).max(80).parse(payload.name),
        p_username: z
          .string()
          .trim()
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,39}$/)
          .parse(payload.email),
        p_password: z.string().min(12).max(128).parse(payload.password),
      });
      if (error || !data?.token)
        return reply(
          {
            error: error?.message.startsWith("APP:")
              ? error.message.slice(4)
              : "Korisničko ime nije dostupno. Pokušajte drugo.",
          },
          400,
        );
      await sb.auth.signOut();
      (await cookies()).set(usernameCookie, data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 43200,
      });
      return reply({ ok: true, recoveryCode: data.recoveryCode });
    }
    if (
      action === "login" &&
      typeof payload.email === "string" &&
      !payload.email.includes("@")
    ) {
      const { data, error } = await sb.rpc("username_login", {
        p_username: z.string().trim().min(1).max(80).parse(payload.email),
        p_password: z.string().min(1).max(128).parse(payload.password),
      });
      if (error || !data?.token)
        return reply(
          { error: data?.error ?? "Prijava trenutno nije dostupna." },
          401,
        );
      await sb.auth.signOut();
      (await cookies()).set(usernameCookie, data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 43200,
      });
      return reply({ ok: true });
    }
    if (action === "resendConfirmation" || action === "forgotPassword") {
      const email = z.email().parse(payload.email);
      const redirect = new URL("/auth/callback", req.url);
      if (action === "forgotPassword")
        redirect.searchParams.set("next", "/auth/reset");
      if (action === "forgotPassword")
        await sb.auth.resetPasswordForEmail(email, {
          redirectTo: redirect.href,
        });
      else
        await sb.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: redirect.href },
        });
      return reply({ ok: true });
    }
    if (action === "resetPassword") {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user)
        return reply({ error: "Otvorite važeći link za obnovu lozinke." }, 401);
      const { error } = await sb.auth.updateUser({
        password: z.string().min(12).max(128).parse(payload.password),
      });
      return error
        ? reply({ error: "Nije moguće promijeniti lozinku." }, 400)
        : reply({ ok: true });
    }
    if (await usernameToken()) {
      if (action === "logout") {
        await usernameCall("logout");
        (await cookies()).delete(usernameCookie);
        return reply({ ok: true });
      }
      if (!["login", "register"].includes(action)) {
        const { data, error } = await usernameCall(action, payload);
        return error
          ? reply(
              {
                error: error.message.startsWith("APP:")
                  ? error.message.slice(4)
                  : "Provjerite pristup i unesene podatke.",
              },
              400,
            )
          : reply(data);
      }
    }
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
      if (!error) (await cookies()).delete(usernameCookie);
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
