"use client";
import { useState, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  ShieldCheck,
  Users,
  LogOut,
  LayoutDashboard,
  MessageCircle,
  MoreHorizontal,
  X,
  BookOpen,
  Package,
  Settings2,
  ClipboardList,
} from "lucide-react";
import { modules, type Actor } from "@/lib/domain";
import ProductLibrary from "./product-library";
import { focusScope } from "./focus-scope";
import Brand from "./brand";
import ThemeControl from "./theme-control";
import OwnerTools from "./owner-tools";
import { PasswordForm } from "./password-form";
export { PasswordForm } from "./password-form";
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
  const [more, setMore] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (more && menu.current)
      return focusScope(menu.current, () => setMore(false));
  }, [more]);
  const go = (id: string) => {
    setView(id);
    setMore(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const primary = [
    { id: "overview", label: "Pregled", icon: LayoutDashboard },
    { id: "clients", label: "Klijenti", icon: Users },
    { id: "messages", label: "Poruke", icon: MessageCircle },
    { id: "groups", label: "Grupe", icon: Users },
  ];
  const secondary = [
    { id: "programs", label: "Programi", icon: BookOpen },
    { id: "products", label: "Proizvodi", icon: Package },
    { id: "users", label: "Korisnici i pregledi", icon: Users },
    { id: "modules", label: "Moduli i dostupnost", icon: Settings2 },
    { id: "audit", label: "Historija aktivnosti", icon: ClipboardList },
    { id: "security", label: "Sigurnost računa", icon: ShieldCheck },
  ];
  const users = data.adminUsers ?? [];
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="entry-brand">
          <Brand />
        </div>
        <span className="avatar sage">A</span>
        <h2>{data.actor.name}</h2>
        <p>Pregled platforme</p>
        <nav aria-label="Administracija">
          {[...primary, ...secondary].map(
            ({ id, label, icon: Icon }, index) => (
              <div className="admin-nav-item-wrap" key={id}>
                {index === 4 && (
                  <span className="nav-section-label">UPRAVLJANJE</span>
                )}
                <button
                  className={view === id ? "active" : ""}
                  aria-current={view === id ? "page" : undefined}
                  onClick={() => go(id)}
                >
                  <Icon size={18} />
                  {label}
                </button>
              </div>
            ),
          )}
        </nav>
        <button className="text-link" onClick={logout}>
          <LogOut size={16} /> Odjavite se
        </button>
      </aside>
      <main className="admin-main">
        <div className="admin-utilities">
          <span>Administracija</span>
          <ThemeControl />
        </div>
        {!["clients", "messages", "groups", "programs", "products"].includes(
          view,
        ) && (
          <>
            <h1>Dobro došli, {data.actor.name}.</h1>
            <p className="muted">
              Pregled korisničkih prostora i razvoj platforme.
            </p>
            <section
              className="role-previews"
              aria-label="Pregledi korisničkih prostora"
            >
              <h2>Odaberite prostor</h2>
              <p>
                Pregledi su samo za čitanje. Privatna evidencija zahtijeva
                dozvolu klijenta.
              </p>
              <div>
                {["client", "trainer", "doctor"].map((role) => {
                  const user = users.find((u) => u.role === role);
                  return (
                    <button
                      className="secondary"
                      key={role}
                      disabled={!user && role !== "trainer"}
                      onClick={() => preview(user?.id ?? "role:trainer")}
                    >
                      {roles[role]} <ArrowUpRight size={16} />
                    </button>
                  );
                })}
                <button className="secondary" disabled>
                  Nutricionista · U pripremi
                </button>
                <button className="secondary" disabled>
                  Fizioterapeut · U pripremi
                </button>
              </div>
            </section>
          </>
        )}
        {["clients", "messages", "groups", "programs"].includes(view) && (
          <div className="admin-tool-content">
            <OwnerTools
              key={view}
              initialView={view === "programs" ? "library" : view}
              data={data}
              preview={preview}
              logout={logout}
            />
          </div>
        )}
        {view === "products" && <ProductLibrary admin />}
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
      <nav className="admin-phone-nav" aria-label="Glavna navigacija">
        {primary.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={view === id ? "active" : ""}
            aria-current={view === id ? "page" : undefined}
            onClick={() => go(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
        <button
          className={secondary.some((n) => n.id === view) ? "active" : ""}
          onClick={() => setMore(true)}
          aria-expanded={more}
          aria-haspopup="dialog"
        >
          <MoreHorizontal size={21} />
          <span>Više</span>
        </button>
      </nav>
      {more && (
        <div className="admin-menu-backdrop" onClick={() => setMore(false)}>
          <div
            ref={menu}
            className="admin-phone-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-menu-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <span className="sheet-kicker">ALDA CONNECT</span>
                <h2 id="admin-menu-title">Vaš radni prostor</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Zatvorite navigaciju"
                onClick={() => setMore(false)}
              >
                <X size={21} />
              </button>
            </header>
            <div className="admin-menu-links">
              {secondary.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => go(id)}
                  aria-current={view === id ? "page" : undefined}
                >
                  <Icon size={19} />
                  {label}
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
            <button className="text-link" onClick={logout}>
              <LogOut size={17} /> Odjavite se
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
