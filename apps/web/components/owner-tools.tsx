"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  Users,
  LogOut,
  Search,
  LayoutDashboard,
  MessageCircle,
  BookOpen,
  Settings,
  Activity,
  ArrowLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { type Actor } from "@/lib/domain";
import { programExercises } from "@/lib/programs";
import { portalAction, useLiveUpdates } from "@/lib/live-updates";
import Brand from "./brand";
import ThemeControl from "./theme-control";
import ProgramLibrary from "./program-library";
import TrainingGroups, {
  MessageFeed,
  ChatComposer,
  type PortalData,
} from "./training-groups";
import { PasswordForm } from "./password-form";
export { PasswordForm } from "./password-form";
export type AdminData = {
  actor: Actor;
  adminUsers?: { id: string; name: string; role: string; onboarded: boolean }[];
  audit?: { action: string; created_at: string; actor_id: string }[];
};
type Client = {
  id: string;
  name: string;
  onboarded: boolean;
  created_at: string;
  plan_title: string | null;
  last_workout: string | null;
  workouts_week: number;
  pending_checkins: number;
};
type OwnerPortal = PortalData & {
  clients: Client[];
  tasks: {
    id: string;
    clientId: string;
    note: string;
    energy: number;
    sleep: number;
    created_at: string;
  }[];
  audit: NonNullable<AdminData["audit"]>;
};
type Prepared = {
  title: string;
  exercises: NonNullable<ReturnType<typeof programExercises>>;
};
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");
const date = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("bs-BA", {
        day: "numeric",
        month: "short",
      })
    : "Još nema";
export default function OwnerTools({
  data,
  preview,
  logout,
  initialView = "clients",
}: {
  data: AdminData;
  preview: (id: string) => void;
  logout: () => void;
  initialView?: string;
}) {
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [person, setPerson] = useState("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const live = useLiveUpdates<OwnerPortal>("/api/portal", true, 15000);
  const messageLive = useLiveUpdates<PortalData>(
    "/api/portal?scope=messages",
    view === "messages",
  );
  const clients = live.data?.clients || [];
  const eligible = live.data?.coachingClients || [];
  const roster = clients.length
    ? clients
    : (data.adminUsers || [])
        .filter((u) => u.role === "client")
        .map((u) => ({
          ...u,
          created_at: "",
          plan_title: null,
          last_workout: null,
          workouts_week: 0,
          pending_checkins: 0,
        }));
  const pending = clients.reduce((s, c) => s + c.pending_checkins, 0);
  const unplanned = clients.filter((c) => !c.plan_title);
  const attention = clients.filter(
    (c) => !c.onboarded || !c.plan_title || c.pending_checkins > 0,
  );
  const filtered = roster.filter(
    (c) =>
      c.name.toLocaleLowerCase("bs").includes(query.toLocaleLowerCase("bs")) &&
      (filter === "all" ||
        (filter === "attention" && attention.some((a) => a.id === c.id)) ||
        (filter === "active" && eligible.includes(c.id))),
  );
  const audit = live.data?.audit ?? data.audit;
  const chosen = roster.find((c) => c.id === person);
  const conversations =
    messageLive.data?.directMessages ?? live.data?.directMessages ?? [];
  const messages = conversations.filter(
    (m) => m.sender_id === person || m.recipient_id === person,
  );
  const nav = [
    { id: "overview", label: "Pregled", icon: LayoutDashboard },
    { id: "clients", label: "Klijenti", icon: Users },
    { id: "messages", label: "Poruke", icon: MessageCircle },
    { id: "groups", label: "Trening grupe", icon: Users },
    { id: "library", label: "Programi", icon: BookOpen },
    { id: "settings", label: "Postavke", icon: Settings },
  ];
  const current = nav.find((n) => n.id === view);
  const go = (id: string) => {
    setView(id);
    setPrepared(null);
    setPerson("");
  };
  return (
    <div className="owner-shell">
      <aside className="owner-sidebar">
        <Brand />
        <span className="owner-workspace-label">RADNI PROSTOR</span>
        <nav aria-label="Vlasnički prostor">
          {nav.map((n) => (
            <button
              key={n.id}
              aria-current={view === n.id ? "page" : undefined}
              className={view === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.id === "clients" && <small>{roster.length}</small>}
            </button>
          ))}
        </nav>
        <div className="owner-profile">
          <span className="avatar sage">{initials(data.actor.name)}</span>
          <div>
            <strong>{data.actor.name}</strong>
            <small>Vlasnik prostora</small>
          </div>
          <button
            className="icon-button"
            aria-label="Odjavite se"
            onClick={logout}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="owner-main">
        <header className="owner-topbar">
          <span>
            Alda Connect <ChevronRight size={13} /> {current?.label}
          </span>
          <ThemeControl />
          <button
            className="icon-button owner-mobile-settings"
            aria-label="Postavke prostora"
            onClick={() => go("settings")}
          >
            <Settings size={18} />
          </button>
        </header>
        <div className="owner-content">
          {view === "overview" && (
            <>
              <div className="owner-welcome">
                <div>
                  <span className="sheet-kicker">
                    VAŠ PROSTOR, VAŠ LJUDSKI PRISTUP.
                  </span>
                  <h1>Dobar dan, {data.actor.name.split(" ")[0]}.</h1>
                  <p>Jasan pregled. Više vremena za vaše klijente.</p>
                </div>
                <button className="primary" onClick={() => go("groups")}>
                  <Plus size={17} /> Kreirajte grupu
                </button>
              </div>
              <div className="crm-stats">
                <article>
                  <Users size={18} />
                  <span>Vaši klijenti</span>
                  <strong>{roster.length}</strong>
                  <small>{eligible.length} povezano s vama</small>
                </article>
                <article>
                  <Activity size={18} />
                  <span>Treninzi ove sedmice</span>
                  <strong>
                    {clients.reduce((s, c) => s + c.workouts_week, 0)}
                  </strong>
                  <small>Posljednjih sedam dana</small>
                </article>
                <article>
                  <MessageCircle size={18} />
                  <span>Čeka pregled</span>
                  <strong>{pending}</strong>
                  <small>Klijentskih izvještaja</small>
                </article>
                <article>
                  <BookOpen size={18} />
                  <span>Bez aktivnog plana</span>
                  <strong>{unplanned.length}</strong>
                  <small>Pripremite sljedeći korak</small>
                </article>
              </div>
              <div className="crm-overview-grid">
                <section className="crm-panel">
                  <div className="section-heading">
                    <div>
                      <span className="sheet-kicker">SLJEDEĆI KORACI</span>
                      <h2>Za vašu pažnju</h2>
                    </div>
                    <span className="pill">{attention.length}</span>
                  </div>
                  {attention.slice(0, 6).map((c) => (
                    <button
                      className="crm-attention-row"
                      key={c.id}
                      onClick={() => {
                        setPerson(c.id);
                        setView("clients");
                      }}
                    >
                      <span className="avatar sage">{initials(c.name)}</span>
                      <span>
                        <strong>{c.name}</strong>
                        <small>
                          {!c.onboarded
                            ? "Uvodni koraci nisu završeni"
                            : c.pending_checkins
                              ? c.pending_checkins + " izvještaja čeka pregled"
                              : "Potrebno je dodijeliti plan"}
                        </small>
                      </span>
                      <ArrowUpRight size={17} />
                    </button>
                  ))}
                  {!attention.length && (
                    <div className="empty-state">
                      <CheckCircle2 size={28} />
                      <h3>Sve je pregledno.</h3>
                      <p>Novi izvještaji i klijenti pojavit će se ovdje.</p>
                    </div>
                  )}
                </section>
                <section className="crm-panel crm-library-promo">
                  <span className="sheet-kicker">
                    PAŽLJIVO PRIPREMLJENA KOLEKCIJA
                  </span>
                  <h2>
                    Plan za svaki
                    <br />
                    sljedeći korak.
                  </h2>
                  <img
                    src="/programs/training.webp"
                    alt="Prostor za trening s kettlebellom i prostirkom"
                  />
                  <button
                    className="secondary full"
                    onClick={() => go("library")}
                  >
                    Istražite 18 programa <ArrowUpRight size={16} />
                  </button>
                </section>
              </div>
            </>
          )}
          {view === "clients" && (
            <>
              <div className="section-heading">
                <div>
                  <span className="sheet-kicker">ODNOS PRIJE SVEGA</span>
                  <h1>{chosen ? chosen.name : "Vaši klijenti"}</h1>
                  <p className="muted">
                    Plan, aktivnost i podrška na jednom mjestu.
                  </p>
                </div>
                <button className="primary" onClick={() => go("groups")}>
                  <Plus size={16} /> Pozovite u grupu
                </button>
              </div>
              {chosen ? (
                <>
                  <button className="text-link" onClick={() => setPerson("")}>
                    <ArrowLeft size={16} /> Svi klijenti
                  </button>
                  <div className="crm-client-profile crm-panel">
                    <span className="avatar sage">{initials(chosen.name)}</span>
                    <div>
                      <h2>{chosen.name}</h2>
                      <p>
                        {chosen.onboarded
                          ? "Uvodni koraci završeni"
                          : "Uvodni koraci u toku"}
                      </p>
                      <span className="pill">
                        {eligible.includes(chosen.id)
                          ? "Vaš klijent"
                          : "Čeka povezivanje s vama"}
                      </span>
                    </div>
                    <button
                      className="secondary"
                      onClick={() => preview(chosen.id)}
                    >
                      Otvorite profil <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="crm-stats">
                    <article>
                      <span>Aktivni plan</span>
                      <h3>{chosen.plan_title || "Još nije dodijeljen"}</h3>
                    </article>
                    <article>
                      <span>Posljednji trening</span>
                      <strong>{date(chosen.last_workout)}</strong>
                    </article>
                    <article>
                      <span>Treninzi · 7 dana</span>
                      <strong>{chosen.workouts_week}</strong>
                    </article>
                    <article>
                      <span>Izvještaji za pregled</span>
                      <strong>{chosen.pending_checkins}</strong>
                    </article>
                  </div>
                  {live.data?.tasks
                    .filter((t) => t.clientId === person)
                    .map((t) => (
                      <ReviewCard key={t.id} task={t} done={live.refresh} />
                    ))}
                  <div className="food-actions">
                    <button
                      className="primary"
                      onClick={() => setView("messages")}
                    >
                      Otvorite razgovor <MessageCircle size={16} />
                    </button>
                    <button
                      className="secondary"
                      onClick={() => setView("library")}
                    >
                      Pripremite program <BookOpen size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="program-tools">
                    <label className="crm-search">
                      <Search size={17} />
                      <input
                        aria-label="Pretražite klijente"
                        placeholder="Pronađite klijenta…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <div className="collection-tabs">
                      {[
                        ["all", "Svi"],
                        ["active", "Povezani"],
                        ["attention", "Za pažnju"],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          aria-pressed={filter === id}
                          onClick={() => setFilter(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <section className="crm-panel crm-roster">
                    <div className="crm-roster-heading">
                      <span>Klijent</span>
                      <span>Aktivni plan</span>
                      <span>Posljednji trening</span>
                      <span>Status</span>
                    </div>
                    {filtered.map((c) => (
                      <button
                        className="crm-client-row"
                        key={c.id}
                        onClick={() => setPerson(c.id)}
                      >
                        <span className="crm-person">
                          <span className="avatar sage">
                            {initials(c.name)}
                          </span>
                          <span>
                            <strong>{c.name}</strong>
                            <small>
                              {c.onboarded
                                ? "Uvodni koraci završeni"
                                : "Uvodni koraci u toku"}
                            </small>
                          </span>
                        </span>
                        <span className="crm-plan-name">
                          {c.plan_title || "Bez plana"}
                        </span>
                        <span className="crm-last-workout">
                          {date(c.last_workout)}
                        </span>
                        <span
                          className={
                            "pill " +
                            (c.pending_checkins ? "peach-pill" : "sage-pill")
                          }
                        >
                          {c.pending_checkins
                            ? c.pending_checkins + " za pregled"
                            : eligible.includes(c.id)
                              ? "Povezan"
                              : "Novi profil"}
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                    {!filtered.length && (
                      <div className="empty-state">
                        <Users size={30} />
                        <h3>
                          {query
                            ? "Nema klijenata za ovu pretragu."
                            : "Ovdje počinje vaš tim."}
                        </h3>
                        <p>Novi računi pojavit će se u ovom pregledu.</p>
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          )}
          {view === "messages" && (
            <>
              <div className="section-heading">
                <div>
                  <span className="sheet-kicker">OSOBNA PODRŠKA</span>
                  <h1>Razgovori</h1>
                </div>
                <span className="chat-status">
                  <i
                    className={
                      messageLive.connected ? "online-dot" : "offline-dot"
                    }
                  />
                  {messageLive.connected
                    ? "Automatsko osvježavanje"
                    : "Povezivanje…"}
                </span>
              </div>
              <div className="messages-layout crm-inbox">
                <aside>
                  {roster.map((c) => {
                    const last = conversations
                      .filter(
                        (m) => m.sender_id === c.id || m.recipient_id === c.id,
                      )
                      .at(-1);
                    return (
                      <button
                        key={c.id}
                        className={person === c.id ? "selected" : ""}
                        onClick={() => setPerson(c.id)}
                      >
                        <span className="avatar sage">{initials(c.name)}</span>
                        <span>
                          <strong>{c.name}</strong>
                          <small>{last?.body || "Započnite razgovor"}</small>
                        </span>
                      </button>
                    );
                  })}
                </aside>
                <section className="conversation">
                  {chosen ? (
                    <>
                      <header>
                        <span className="avatar sage">
                          {initials(chosen.name)}
                        </span>
                        <div>
                          <strong>{chosen.name}</strong>
                          <small>
                            {eligible.includes(person)
                              ? "Vaš klijent"
                              : "Prvo pošaljite poziv u trening grupu"}
                          </small>
                        </div>
                      </header>
                      <MessageFeed
                        key={person}
                        messages={messages}
                        actorId={data.actor.id}
                      />
                      <ChatComposer
                        key={person + "composer"}
                        disabled={!eligible.includes(person)}
                        send={async (text) => {
                          await portalAction("ownerMessage", {
                            recipientId: person,
                            text,
                          });
                          await messageLive.refresh();
                        }}
                      />
                    </>
                  ) : (
                    <div className="empty-state">
                      <MessageCircle size={32} />
                      <h3>Svaki razgovor je važan.</h3>
                      <p>Odaberite klijenta za pregled poruka.</p>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          {view === "groups" && (
            <TrainingGroups actorId={data.actor.id} owner clients={roster} />
          )}
          {view === "library" &&
            (prepared ? (
              <OwnerPlan
                prepared={prepared}
                clients={roster.filter((c) => eligible.includes(c.id))}
                initialClient={person}
                close={() => setPrepared(null)}
                done={async () => {
                  setPrepared(null);
                  await live.refresh();
                }}
              />
            ) : (
              <ProgramLibrary
                accountId={data.actor.id}
                onPrepare={(title, exercises) =>
                  setPrepared({ title, exercises })
                }
              />
            ))}
          {view === "settings" && (
            <>
              <h1>Postavke prostora</h1>
              <section className="crm-panel">
                <h2>Sigurnost računa</h2>
                <PasswordForm />
              </section>
              <section className="crm-panel">
                <h2>Aktivnost prostora</h2>
                {audit?.length ? (
                  audit.map((a, i) => (
                    <div className="crm-member-line" key={i}>
                      <span>
                        {(
                          {
                            group_invitation: "Poziv u grupu",
                            groupMessage: "Poruka u grupi",
                            createGroup: "Kreirana grupa",
                            publishPlan: "Objavljen plan",
                            message: "Poslana poruka",
                          } as Record<string, string>
                        )[a.action] || "Aktivnost računa"}
                      </span>
                      <time>{date(a.created_at)}</time>
                    </div>
                  ))
                ) : (
                  <p className="muted">Još nema zabilježenih aktivnosti.</p>
                )}
              </section>
              <button className="secondary" onClick={logout}>
                <LogOut size={16} /> Odjavite se
              </button>
            </>
          )}
          {live.error && (
            <p className="food-error" role="status">
              {live.error}
            </p>
          )}
        </div>
      </main>
      <nav className="owner-mobile-nav" aria-label="Brzi vlasnički meni">
        {nav.slice(0, 5).map((n) => (
          <button
            key={n.id}
            aria-current={view === n.id ? "page" : undefined}
            onClick={() => go(n.id)}
          >
            <n.icon size={19} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
function OwnerPlan({
  prepared,
  clients,
  initialClient,
  close,
  done,
}: {
  prepared: Prepared;
  clients: { id: string; name: string }[];
  initialClient: string;
  close: () => void;
  done: () => Promise<void>;
}) {
  const [items, setItems] = useState(prepared.exercises);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="crm-panel">
      <button className="text-link" onClick={close}>
        <ArrowLeft size={16} /> Programi
      </button>
      <h2>Prilagodite plan klijentu</h2>
      {!clients.length ? (
        <p className="information">
          Prvo povežite klijenta pozivom u trening grupu. Plan možete objaviti
          nakon što klijent prihvati poziv.
        </p>
      ) : (
        <form
          className="owner-plan-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await portalAction("ownerPlan", {
                clientId: f.get("client"),
                title: f.get("title"),
                reason: f.get("reason"),
                exercises: items,
              });
              await done();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Plan nije objavljen.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Klijent
            <select
              name="client"
              defaultValue={initialClient || clients[0]?.id}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Naziv plana
            <input
              name="title"
              required
              minLength={3}
              maxLength={120}
              defaultValue={prepared.title.slice(0, 120)}
            />
          </label>
          <div className="owner-plan-exercises">
            {items.map((ex, i) => (
              <div key={ex.id}>
                <label>
                  Vježba {i + 1}
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={ex.name}
                    onChange={(e) =>
                      setItems(
                        items.map((v, n) =>
                          n === i ? { ...v, name: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Serije
                  <input
                    required
                    type="number"
                    min={1}
                    max={10}
                    value={ex.sets}
                    onChange={(e) =>
                      setItems(
                        items.map((v, n) =>
                          n === i ? { ...v, sets: Number(e.target.value) } : v,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Ponavljanja / trajanje
                  <input
                    required
                    maxLength={30}
                    value={ex.reps}
                    onChange={(e) =>
                      setItems(
                        items.map((v, n) =>
                          n === i ? { ...v, reps: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <label>
            Razlog i prilagodba
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={500}
              placeholder="Šta ste prilagodili ovom klijentu?"
            />
          </label>
          <button className="primary" disabled={busy}>
            Objavite plan <ArrowUpRight size={16} />
          </button>
          {error && (
            <p role="alert" className="food-error">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

function ReviewCard({
  task,
  done,
}: {
  task: OwnerPortal["tasks"][number];
  done: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <section className="crm-panel">
      <span className="sheet-kicker">IZVJEŠTAJ · {date(task.created_at)}</span>
      <h2>Kako se vaš klijent osjeća</h2>
      <p className="muted">
        Energija {task.energy}/5 · San {task.sleep} h
      </p>
      <p>{task.note || "Bez dodatne bilješke."}</p>
      <form
        className="owner-plan-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await portalAction("ownerReview", {
              taskId: task.id,
              note: f.get("note"),
            });
            await done();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Pregled nije sačuvan.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Vaš odgovor
          <textarea
            name="note"
            required
            minLength={1}
            maxLength={2000}
            placeholder="Podrška i sljedeći korak za klijenta…"
          />
        </label>
        <button className="primary" disabled={busy}>
          Sačuvajte pregled <CheckCircle2 size={16} />
        </button>
        {error && (
          <p className="food-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
