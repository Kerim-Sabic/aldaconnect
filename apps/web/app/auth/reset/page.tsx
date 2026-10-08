"use client";
import { useState } from "react";
export default function ResetPassword() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <main className="reset-page">
      <div className="brand-symbol">f.</div>
      <h1>Nova lozinka, vaš prostor.</h1>
      {done ? (
        <>
          <p role="status">Lozinka je promijenjena.</p>
          <a className="primary" href="/">
            Otvorite svoj prostor
          </a>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (f.get("password") !== f.get("confirm")) {
              setMessage("Lozinke se ne podudaraju.");
              return;
            }
            setBusy(true);
            try {
              const r = await fetch("/api/workspace", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "resetPassword",
                  payload: { password: f.get("password") },
                }),
              });
              const d = await r.json();
              if (r.ok) setDone(true);
              else setMessage(d.error);
            } catch {
              setMessage("Provjerite internetsku vezu i pokušajte ponovo.");
            } finally {
              setBusy(false);
            }
          }}
        >
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
          <label>
            Ponovite novu lozinku
            <input
              name="confirm"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <button className="primary" disabled={busy}>
            Sačuvajte lozinku
          </button>
          {message && <p role="alert">{message}</p>}
        </form>
      )}
    </main>
  );
}
