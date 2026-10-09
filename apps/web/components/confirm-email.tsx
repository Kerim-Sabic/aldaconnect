"use client";
import { useState } from "react";
export default function ConfirmEmail({
  tokenHash,
  type,
}: {
  tokenHash: string;
  type: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="reset-page">
      <div className="brand-symbol">f.</div>
      <h1>
        {type === "recovery"
          ? "Vratite se u svoj prostor."
          : "Dobro došli u svoj prostor."}
      </h1>
      <p>
        {type === "recovery"
          ? "Potvrdite zahtjev da postavite novu lozinku."
          : "Potvrdite svoju adresu e-pošte da nastavite."}
      </p>
      <button
        className="primary"
        disabled={busy || !tokenHash}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/auth/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token_hash: tokenHash, type }),
            });
            const d = await r.json();
            if (r.ok) window.location.replace(d.next);
            else setError(d.error);
          } catch {
            setError("Provjerite vezu i pokušajte ponovo.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Potvrđujemo…"
          : type === "recovery"
            ? "Nastavite na obnovu lozinke"
            : "Potvrdite e-poštu"}
      </button>
      {(!tokenHash || error) && (
        <p role="alert">
          {error || "Link nije ispravan. Zatražite novu poruku."}
        </p>
      )}
      <p>
        <a href="/app">Povratak na prijavu</a>
      </p>
    </main>
  );
}
