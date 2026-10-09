"use client";
import { useState } from "react";
export function PasswordForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="password-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        setBusy(true);
        try {
          const r = await fetch("/api/workspace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "changePassword",
              payload: {
                currentPassword: f.get("currentPassword"),
                password: f.get("password"),
              },
            }),
          });
          const d = await r.json();
          setMessage(r.ok ? "Lozinka je promijenjena." : d.error);
          if (r.ok) form.reset();
        } catch {
          setMessage("Nije moguće povezati se. Pokušajte ponovo.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Trenutna lozinka
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </label>
      <label>
        Nova lozinka
        <input
          name="password"
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>
      <button className="primary" disabled={busy}>
        Promijenite lozinku
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
