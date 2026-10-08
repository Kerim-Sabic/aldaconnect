"use client";
import { useState } from "react";
import { ArrowUpRight, ShieldCheck, Users, LogOut } from "lucide-react";
import { modules, type Actor } from "@/lib/domain";
export type AdminData = {
  actor: Actor;
  adminUsers?: { id: string; name: string; role: string; onboarded: boolean }[];
  audit?: { action: string; created_at: string; actor_id: string }[];
};
const roles: Record<string, string> = {
  admin: "Administrator",
  client: "Klijent",
  trainer: "Trener",
  doctor: "Ljekar",
  nutritionist: "Nutricionista",
  therapist: "Fizioterapeut",
};
export default function AdminWorkspace({
  data,
  preview,
  logout,
}: {
  data: AdminData;
  preview(id: string): void;
  logout(): void;
}) {
  const [view, setView] = useState("overview");
  const [query, setQuery] = useState("");
  const users = data.adminUsers ?? [];
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="entry-brand">
          <div className="brand-symbol">f.</div>
          <span>
            fitness <small>ADMINISTRACIJA</small>
          </span>
        </div>
        <span className="avatar sage">A</span>
        <h2>{data.actor.name}</h2>
        <p>Pregled platforme</p>
        <nav aria-label="Administracija">
          {[
            ["overview", "Pregled"],
            ["users", "Korisnici i pregledi"],
            ["modules", "Moduli i dostupnost"],
            ["audit", "Historija aktivnosti"],
            ["security", "Sigurnost računa"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button className="text-link" onClick={logout}>
          <LogOut size={16} /> Odjavite se
        </button>
      </aside>
      <main className="admin-main">
        <span className="eyebrow">GLAVNI ADMINISTRATOR</span>
        <h1>Dobro došli, {data.actor.name}.</h1>
        <p className="muted">
          Pregled korisničkih prostora i razvoj platforme.
        </p>
        {view === "overview" && (
          <>
            <div className="admin-stats">
              <article>
                <Users />
                <strong>{users.length}</strong>
                <span>Ukupno profila</span>
              </article>
              <article>
                <ShieldCheck />
                <strong>
                  {users.filter((u) => u.role === "client").length}
                </strong>
                <span>Klijenata</span>
              </article>
              <article>
                <strong>
                  {modules.filter((m) => m.available).length} / {modules.length}
                </strong>
                <span>Dostupnih modula</span>
              </article>
            </div>
            <section className="admin-card">
              <h2>Svi prostori na jednom mjestu.</h2>
              <p>
                Otvorite prikaz klijenta ili trenera. Pregled je samo za čitanje
                i ne mijenja identitet vašeg računa.
              </p>
              <button className="primary" onClick={() => setView("users")}>
                Otvorite preglede <ArrowUpRight size={17} />
              </button>
            </section>
            <div className="information">
              Razvojna verzija. Napredni stručni moduli, naplata i klinički
              tokovi još nisu spremni za korištenje.
            </div>
          </>
        )}
        {view === "users" && (
          <section className="admin-card">
            <h2>Korisnici i pregledi</h2>
            <p>
              Otvorite postojeći profil ili pregled praznog stručnog prostora.
            </p>
            <button className="primary" onClick={() => preview("role:trainer")}>
              Pregled prostora trenera <ArrowUpRight size={17} />
            </button>
            <label>
              Pretražite korisnike
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ime ili uloga"
              />
            </label>
            <div className="admin-roster">
              {users
                .filter((u) =>
                  (u.name + " " + roles[u.role])
                    .toLocaleLowerCase("bs")
                    .includes(query.toLocaleLowerCase("bs")),
                )
                .map((u) => (
                  <article key={u.id}>
                    <span className="avatar peach">{u.name[0]}</span>
                    <div>
                      <strong>{u.name}</strong>
                      <small>
                        {roles[u.role]} ·{" "}
                        {u.onboarded
                          ? "Uvodni koraci završeni"
                          : "Uvodni koraci nisu završeni"}
                      </small>
                    </div>
                    {["client", "trainer", "doctor"].includes(u.role) ? (
                      <button
                        className="text-link"
                        onClick={() => preview(u.id)}
                      >
                        Otvorite pregled <ArrowUpRight size={17} />
                      </button>
                    ) : (
                      <span className="pill sage-pill">
                        {u.role === "admin" ? "Ovaj prostor" : "U pripremi"}
                      </span>
                    )}
                  </article>
                ))}
            </div>
            <p className="muted">
              Prostori nutricioniste i fizioterapeuta još su u pripremi.
            </p>
          </section>
        )}
        {view === "modules" && (
          <section className="admin-card">
            <h2>Dostupnost modula</h2>
            {modules.map((m) => (
              <article className="admin-module" key={m.id}>
                <div>
                  <strong>{m.name}</strong>
                  <p>{m.description}</p>
                </div>
                <span
                  className={
                    "pill " + (m.available ? "sage-pill" : "peach-pill")
                  }
                >
                  {m.available ? "Dostupno" : "U pripremi"}
                </span>
              </article>
            ))}
          </section>
        )}
        {view === "audit" && (
          <section className="admin-card">
            <h2>Historija aktivnosti</h2>
            <p>Evidencija radnji bez sadržaja poruka i zdravstvenih zapisa.</p>
            {data.audit?.length ? (
              data.audit.map((a, i) => (
                <article className="admin-module" key={i}>
                  <span>{a.action}</span>
                  <time>{new Date(a.created_at).toLocaleString("bs-BA")}</time>
                </article>
              ))
            ) : (
              <p>Još nema zabilježenih aktivnosti.</p>
            )}
          </section>
        )}
        {view === "security" && (
          <section className="admin-card">
            <h2>Sigurnost računa</h2>
            <p>
              Početnu lozinku zamijenite vlastitom lozinkom. Promjena odjavljuje
              ostale sesije ovog računa.
            </p>
            <PasswordForm />
          </section>
        )}
      </main>
    </div>
  );
}
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
