"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Brand from "./brand";
import ThemeControl from "./theme-control";
import dynamic from "next/dynamic";
const moduleLoading = () => (
  <p className="module-loading" role="status">
    Učitavamo vaš prostor…
  </p>
);
const Onboarding = dynamic(() => import("./onboarding"), {
  loading: moduleLoading,
});
const CycleDiary = dynamic(() => import("./cycle-diary"), {
  loading: moduleLoading,
});
const MedicationRecords = dynamic(() => import("./medication-records"), {
  loading: moduleLoading,
});
const LabRecords = dynamic(() => import("./lab-records"), {
  loading: moduleLoading,
});
const DoctorWorkspace = dynamic(() => import("./doctor-workspace"), {
  loading: moduleLoading,
});
import AdminWorkspace, {
  PasswordForm,
  type AdminData,
} from "./admin-workspace";
import {
  Activity,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  Droplets,
  Dumbbell,
  Heart,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react";
import {
  modules,
  exercises as defaultExercises,
  type Actor,
  isTimed,
} from "@/lib/domain";
type Exercise = (typeof defaultExercises)[number];
type Plan = {
  id: string;
  title: string;
  version: number;
  exercises: Exercise[];
  author_name: string;
  reason: string;
};
type Log = {
  session_id: string;
  exercise_id: string;
  set_index: number;
  weight: number;
  reps: number | null;
  duration_seconds: number | null;
  plan_id: string;
};
type Person = { id: string; name: string; email?: string; role?: string };
type Task = {
  id: string;
  checkin_id?: string;
  client_id: string;
  client_name: string;
  kind: string;
  title: string;
  status: string;
};
type Message = {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};
type Diary = {
  id: string;
  kind: string;
  label: string;
  value: number | null;
  created_at: string;
};
type State = {
  adminUsers?: AdminData["adminUsers"];
  audit?: AdminData["audit"];
  readOnly?: boolean;
  usernameAccount?: boolean;
  mustChangePassword?: boolean;
  sessions: { id: string; plan_id: string; completed_at: string | null }[];
  actor: Actor;
  preferences: {
    modules: string[];
    intake: Record<string, unknown>;
    version: number;
  };
  clients: Person[];
  clientId: string;
  plans: Plan[];
  logs: Log[];
  checkins: {
    id: string;
    energy: number;
    sleep: number;
    note: string;
    status: string;
    review_note?: string;
  }[];
  tasks: Task[];
  team: Person[];
  messages: Message[];
  diary: Diary[];
};
type Modal = { kind: string; task?: Task } | null;
type Queued = { action: "logSet"; payload: Record<string, unknown> };
const initials = (name: string) =>
  name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
const dateLabel = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: "Europe/Sarajevo",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const days: Record<string, string> = {
    Monday: "ponedjeljak",
    Tuesday: "utorak",
    Wednesday: "srijeda",
    Thursday: "četvrtak",
    Friday: "petak",
    Saturday: "subota",
    Sunday: "nedjelja",
  };
  const months = [
    "januar",
    "februar",
    "mart",
    "april",
    "maj",
    "juni",
    "juli",
    "august",
    "septembar",
    "oktobar",
    "novembar",
    "decembar",
  ];
  return (
    days[part("weekday")] +
    ", " +
    part("day") +
    ". " +
    months[Number(part("month")) - 1]
  );
};
const time = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const first = (name: string) => name.split(" ")[0];

export default function Workspace() {
  const [previewId, setPreviewId] = useState<string | null>(null);
  return (
    <WorkspaceView
      key={previewId ?? "main"}
      previewId={previewId}
      setPreviewId={setPreviewId}
    />
  );
}
function WorkspaceView({
  previewId,
  setPreviewId,
}: {
  previewId: string | null;
  setPreviewId(id: string | null): void;
}) {
  const [data, setData] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("today");
  const [clientId, setClientId] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [auth, setAuth] = useState<"demo" | "login" | "register">("demo");
  const [queue, setQueue] = useState<Queued[]>([]);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("bs");
  const [cloud, setCloud] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  useEffect(() => {
    document.documentElement.dataset.updateBlocked = String(
      busy || queue.length > 0 || view === "workout" || Boolean(modal),
    );
    return () => {
      delete document.documentElement.dataset.updateBlocked;
    };
  }, [busy, queue.length, view, modal]);
  useEffect(() => {
    setInviteToken(
      new URLSearchParams(window.location.search).get("invite") ?? "",
    );
  }, []);
  useEffect(() => {
    if (inviteToken && data?.actor.role === "client" && data.actor.onboarded)
      setModal({ kind: "acceptInvite" });
  }, [inviteToken, data?.actor.id, data?.actor.onboarded]);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => {
        setCloud(c.cloud);
        if (c.cloud) setAuth("login");
      })
      .catch(() => {});
  }, []);
  const expert = data?.actor.role === "trainer";
  const session = data?.sessions?.find((s) => !s.completed_at);
  const plan =
    (!expert && session
      ? data?.plans.find((p) => p.id === session.plan_id)
      : undefined) ?? data?.plans[0];
  const refresh = useCallback(
    async (selected?: string) => {
      const res = await fetch(
        "/api/workspace?" +
          new URLSearchParams({
            ...(selected ? { client: selected } : {}),
            ...(previewId ? { preview: previewId } : {}),
          }),
        { cache: "no-store" },
      );
      if (res.status === 401) {
        setData(null);
        setLoading(false);
        return;
      }
      const next = await res.json();
      if (!res.ok) throw Error(next.error);
      setData(next);
      setClientId(next.clientId);
      setLoading(false);
      return next as State;
    },
    [previewId],
  );
  useEffect(() => {
    refresh()
      .then((next) => {
        if (next?.actor.role === "trainer") setView("queue");
      })
      .catch((e) => {
        setToast(e.message);
        setLoading(false);
      });
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!data) return;
    try {
      setQueue(
        JSON.parse(
          localStorage.getItem("fitness-queue:" + data.actor.id) ?? "[]",
        ),
      );
    } catch {
      setQueue([]);
    }
  }, [data?.actor.id]);
  const request = async (
    action: string,
    payload: Record<string, unknown> = {},
  ) => {
    if (previewId && action !== "logout")
      throw Error(
        "Ovo je pregled bez izmjena. Vratite se u administratorski prostor.",
      );
    const res = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const value = await res.json();
    if (!res.ok) throw Error(value.error);
    return value;
  };
  const mutate = async (
    action: string,
    payload: Record<string, unknown> = {},
    message = "Sačuvano",
  ) => {
    setBusy(true);
    try {
      const value = await request(action, payload);
      await refresh(expert ? clientId : undefined);
      setToast(message);
      return value;
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Nije moguće sačuvati.");
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const demo = async (role: string) => {
    setBusy(true);
    try {
      await request("demo", { role });
      setQueue([]);
      setView(role === "trainer" ? "queue" : "today");
      setModal(null);
      await refresh();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const changeView = (next: string) => {
    setView(next);
    setMobile(false);
    setQuery("");
  };
  const persistQueue = (next: Queued[]) => {
    if (!data) return;
    setQueue(next);
    localStorage.setItem(
      "fitness-queue:" + data.actor.id,
      JSON.stringify(next),
    );
  };
  const syncQueue = useCallback(async () => {
    if (!data || !navigator.onLine || previewId) return;
    let pending: Queued[] = [];
    try {
      pending = JSON.parse(
        localStorage.getItem("fitness-queue:" + data.actor.id) ?? "[]",
      );
    } catch {
      return;
    }
    for (const item of pending) {
      try {
        const res = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setToast(
              "Prijavite se prvobitnim računom da sinhronizujete serije na čekanju.",
            );
          }
          return;
        }
        pending = pending.filter((q) => q.payload.id !== item.payload.id);
        localStorage.setItem(
          "fitness-queue:" + data.actor.id,
          JSON.stringify(pending),
        );
        setQueue([...pending]);
      } catch {
        return;
      }
    }
    if (pending.length === 0) await refresh();
  }, [data?.actor.id, refresh]);
  useEffect(() => {
    window.addEventListener("online", syncQueue);
    return () => window.removeEventListener("online", syncQueue);
  }, [syncQueue]);
  const logSet = async (
    exercise: Exercise,
    index: number,
    weight: number,
    reps: number,
  ) => {
    if (!data || !plan || !session || previewId) return;
    const payload = {
      sessionId: session.id,
      ...{
        id: crypto.randomUUID(),
        clientId: data.actor.id,
        planId: plan.id,
        exerciseId: exercise.id,
        setIndex: index,
        weight,
        ...(isTimed(exercise) ? { durationSeconds: reps } : { reps }),
      },
    };
    try {
      await mutate("logSet", payload, "Serija je sačuvana. Odlično!");
    } catch (e) {
      if (!navigator.onLine || e instanceof TypeError) {
        persistQueue([...queue, { action: "logSet", payload }]);
        setToast(
          "Sačuvano na ovom uređaju. Sinhronizacija slijedi kada se povežete.",
        );
      }
    }
  };
  const logout = async () => {
    if (
      queue.length &&
      !window.confirm(
        "Na ovom uređaju postoje nesinhronizovane serije. Ostat će vezane za ovaj račun do ponovne prijave. Želite li se odjaviti?",
      )
    )
      return;
    await request("logout");
    setData(null);
    setQueue([]);
    setView("today");
    setMobile(false);
  };
  const formSubmit = async (
    e: FormEvent<HTMLFormElement>,
    fn: (values: FormData) => Promise<void>,
  ) => {
    e.preventDefault();
    try {
      await fn(new FormData(e.currentTarget));
    } catch {}
  };
  const reviewedCheckin = data?.checkins.find(
    (c) => c.id === modal?.task?.checkin_id,
  );
  const selected = data?.preferences.modules ?? [];
  const active = modules.filter((m) => m.available && selected.includes(m.id));
  const completed =
    data?.logs.filter((l) => l.session_id === session?.id).length ?? 0;
  const total = plan?.exercises.reduce((sum, e) => sum + e.sets, 0) ?? 0;
  const logged = (e: Exercise, index: number) =>
    data?.logs.some(
      (l) =>
        l.session_id === session?.id &&
        l.exercise_id === e.id &&
        l.set_index === index,
    ) ||
    queue.some(
      (q) =>
        q.payload.sessionId === session?.id &&
        q.payload.exerciseId === e.id &&
        q.payload.setIndex === index,
    );
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const iconFor = (id: string) =>
    id === "training"
      ? Dumbbell
      : id === "nutrition"
        ? Leaf
        : id === "progress"
          ? ChartNoAxesCombined
          : id === "recovery"
            ? Heart
            : ShieldCheck;
  const notice = (
    <div className="development">
      <span className="status-dot" />
      {cloud ? "Supabase pregled" : "Lokalni razvoj"}{" "}
      <span className="dev-divider">/</span>{" "}
      {cloud
        ? "Razvojna verzija · bez zdravstvenih usluga i naplate"
        : "Izmišljeni profili · bez zdravstvenih usluga i naplate"}
    </div>
  );
  if (loading)
    return (
      <div className="loading">
        <Brand />
        <p>Pripremamo vaš prostor…</p>
      </div>
    );
  if (!data)
    return (
      <div className="entry">
        {notice}
        <div className="entry-theme">
          <ThemeControl />
        </div>
        <div className="entry-brand">
          <Brand />
        </div>
        <main className="entry-grid">
          <section>
            <h1>
              Zajedno smo jači.
              <br />
              <em>Sve je prilagođeno vama.</em>
            </h1>
            <p className="entry-description">
              Trening, svakodnevne navike i ljudi koji vam pomažu da
              napredujete. Sve na jednom mjestu.
            </p>
            <div className="entry-points">
              <span>
                <Dumbbell size={18} /> Jasan plan
              </span>
              <span>
                <Users size={18} /> Povezani stručnjaci
              </span>
              <span>
                <Heart size={18} /> Vaš vlastiti tempo
              </span>
            </div>
          </section>
          <section className="entry-panel">
            <div className="tabs">
              {(cloud
                ? (["login", "register"] as const)
                : (["demo", "login", "register"] as const)
              ).map((x) => (
                <button
                  className={auth === x ? "active" : ""}
                  key={x}
                  onClick={() => setAuth(x)}
                >
                  {x === "demo"
                    ? "Istražite"
                    : x === "login"
                      ? "Prijavite se"
                      : "Kreirajte račun"}
                </button>
              ))}
            </div>
            {auth === "demo" ? (
              <>
                <span className="eyebrow">ZAVIRITE U APLIKACIJU</span>
                <h2>
                  Dvije perspektive.
                  <br />
                  Jedan zajednički plan.
                </h2>
                <p>
                  Istražite izmišljene profile. Promjene se čuvaju lokalno na
                  ovom računaru.
                </p>
                <button
                  className="demo-choice"
                  disabled={busy}
                  onClick={() => demo("client")}
                >
                  <span className="avatar peach">AM</span>
                  <span>
                    <strong>Korisnički prostor</strong>
                    <small>Vaš dan, vaš trening, vaš napredak</small>
                  </span>
                  <ArrowUpRight size={20} />
                </button>
                <button
                  className="demo-choice"
                  disabled={busy}
                  onClick={() => demo("trainer")}
                >
                  <span className="avatar sage">JH</span>
                  <span>
                    <strong>Stručni prostor</strong>
                    <small>Klijenti, izvještaji i planiranje treninga</small>
                  </span>
                  <ArrowUpRight size={20} />
                </button>
                <div className="quiet-note">
                  <ShieldCheck size={17} />
                  <span>
                    Razvojni pregled. Koristite isključivo izmišljene podatke.
                  </span>
                </div>
              </>
            ) : (
              <form
                onSubmit={(e) =>
                  formSubmit(e, async (f) => {
                    setBusy(true);
                    try {
                      const result = await request(auth, {
                        name: f.get("name"),
                        email: f.get("email"),
                        password: f.get("password"),
                      });
                      if (result.confirmationRequired) {
                        setToast(
                          "Potvrdite račun putem e-pošte, a zatim se prijavite.",
                        );
                        setAuth("login");
                      } else {
                        const signedIn = await refresh();
                        setView(
                          signedIn?.actor.role === "trainer"
                            ? "queue"
                            : "today",
                        );
                      }
                    } catch (err) {
                      setToast((err as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  })
                }
              >
                <h2>
                  {auth === "register"
                    ? "Napravite prostor za napredak."
                    : "Dobro došli nazad."}
                </h2>
                <p>
                  {cloud
                    ? "Kreirajte korisnički račun ili se prijavite. U ovoj razvojnoj verziji koristite testne podatke."
                    : "Samo lokalni testni računi. Koristite izmišljene podatke."}
                </p>
                {auth === "register" && (
                  <label>
                    Ime i prezime
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                    />
                  </label>
                )}
                <label>
                  {auth === "login" ? "Korisničko ime ili e-pošta" : "E-pošta"}
                  <input
                    name="email"
                    type={auth === "login" ? "text" : "email"}
                    required
                    autoComplete={auth === "login" ? "username" : "email"}
                  />
                </label>
                <label>
                  Lozinka
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={auth === "login" ? 1 : 12}
                    maxLength={128}
                    autoComplete={
                      auth === "login" ? "current-password" : "new-password"
                    }
                  />
                </label>
                <small>
                  {cloud
                    ? "Najmanje 12 znakova. Novi računi zahtijevaju potvrdu putem e-pošte."
                    : "Najmanje 12 znakova. Ova lokalna verzija ne šalje e-poštu."}
                </small>
                <button className="primary full" disabled={busy}>
                  {busy
                    ? "Molimo sačekajte…"
                    : auth === "register"
                      ? cloud
                        ? "Kreirajte račun"
                        : "Kreirajte lokalni račun"
                      : "Prijavite se"}
                  <ArrowRight size={16} />
                </button>
              </form>
            )}
            {cloud && auth === "login" && (
              <div className="auth-help">
                <button
                  className="text-link"
                  onClick={() => setModal({ kind: "forgotPassword" })}
                >
                  Zaboravili ste lozinku?
                </button>
                <button
                  className="text-link"
                  onClick={() => setModal({ kind: "resendConfirmation" })}
                >
                  Pošaljite potvrdu ponovo
                </button>
              </div>
            )}
            {modal &&
              ["forgotPassword", "resendConfirmation"].includes(modal.kind) && (
                <form
                  onSubmit={(e) =>
                    formSubmit(e, async (f) => {
                      setBusy(true);
                      try {
                        await request(modal.kind, { email: f.get("email") });
                        setToast(
                          "Ako račun postoji, poruka će biti poslana na unesenu adresu.",
                        );
                        setModal(null);
                      } finally {
                        setBusy(false);
                      }
                    })
                  }
                >
                  <h3>
                    {modal.kind === "forgotPassword"
                      ? "Obnova lozinke"
                      : "Potvrda računa"}
                  </h3>
                  <label>
                    E-pošta
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    Pošaljite link
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setModal(null)}
                  >
                    Odustanite
                  </button>
                </form>
              )}
          </section>
        </main>
        {toast && (
          <div role="status" className="toast">
            {toast}
          </div>
        )}
      </div>
    );

  if (data.actor.role === "admin")
    return (
      <AdminWorkspace data={data} preview={setPreviewId} logout={logout} />
    );
  if (data.actor.role === "doctor")
    return (
      <DoctorWorkspace
        name={data.actor.name}
        readOnly={Boolean(previewId)}
        logout={logout}
        back={() => setPreviewId(null)}
      >
        {data.usernameAccount && !previewId && (
          <details>
            <summary>Promjena lozinke</summary>
            <PasswordForm />
          </details>
        )}
      </DoctorWorkspace>
    );
  const nav = expert
    ? [
        { id: "queue", label: "Radni zadaci", icon: ClipboardList },
        { id: "clients", label: "Klijenti", icon: Users },
        { id: "calendar", label: "Kalendar", icon: CalendarDays },
        { id: "library", label: "Biblioteka", icon: BookOpen },
        { id: "messages", label: "Poruke", icon: MessageCircle },
      ]
    : [
        {
          id: "today",
          label: language === "bs" ? "Danas" : "Danas",
          icon: LayoutDashboard,
        },
        {
          id: "plan",
          label: language === "bs" ? "Plan" : "Moj plan",
          icon: CalendarDays,
        },
        {
          id: "progress",
          label: language === "bs" ? "Napredak" : "Napredak",
          icon: ChartNoAxesCombined,
        },
        {
          id: "team",
          label: language === "bs" ? "Moj tim" : "Moj tim",
          icon: Users,
        },
        {
          id: "messages",
          label: language === "bs" ? "Poruke" : "Poruke",
          icon: MessageCircle,
        },
      ];
  if (!expert && (selected.includes("cycle") || previewId))
    nav.push({ id: "cycle", label: "Ciklus i simptomi", icon: Heart });
  if (expert || selected.includes("medications") || previewId)
    nav.push({
      id: "medications",
      label: "Stručna evidencija",
      icon: ShieldCheck,
    });
  if (!expert && (selected.includes("labs") || previewId))
    nav.push({ id: "labs", label: "Nalazi", icon: Heart });
  const title =
    nav.find((n) => n.id === view)?.label ??
    (view === "settings"
      ? "Vaše postavke"
      : view === "nutrition"
        ? "Ishrana"
        : view === "workout"
          ? "Trening"
          : "Vaš prostor");
  const client = data.clients.find((c) => c.id === clientId);
  const PlanCard = () =>
    plan ? (
      <div className="workout-feature">
        <div className="workout-main">
          <div>
            <h2>
              {plan.title.split(" · ")[0]}
              <br />
              <em>{plan.title.split(" · ")[1] ?? "Vaš sljedeći korak"}</em>
            </h2>
            <p>{plan.reason}</p>
            <div className="workout-meta">
              <span>
                <Clock size={15} /> 45–55 min
              </span>
              <span>{plan.exercises.length} vježbi</span>
              <span>Teretana</span>
            </div>
            <button
              className="peach-button"
              disabled={busy}
              onClick={async () => {
                try {
                  if (!session)
                    await mutate(
                      "startSession",
                      { planId: plan.id },
                      "Trening je započet.",
                    );
                  changeView("workout");
                } catch {}
              }}
            >
              {session ? "Nastavite trening" : "Započnite trening"}
              <ArrowUpRight size={18} />
            </button>
          </div>
          <div className="workout-sequence" aria-label="Vježbe u planu">
            {plan.exercises.slice(0, 3).map((exercise, index) => (
              <div key={exercise.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{exercise.name}</strong>
              </div>
            ))}
            {plan.exercises.length > 3 && (
              <small>+ {plan.exercises.length - 3} u vašem planu</small>
            )}
          </div>
        </div>
        <div className="feature-footer">
          <span>
            <span className="avatar tiny sage">
              {initials(plan.author_name)}
            </span>
            Plan pripremio/la {first(plan.author_name)}
          </span>
          <span>
            Verzija {plan.version} <Check size={14} />
          </span>
        </div>
      </div>
    ) : (
      <div className="empty-plan">
        <Dumbbell size={32} />
        <h2>Ovdje počinje vaš sljedeći korak.</h2>
        <p>
          {data.actor.onboarded
            ? data.team.some((person) => person.role === "trainer")
              ? "Plan još nije dodijeljen. Javite se svom treneru za sljedeći korak."
              : "Vaše postavke su sačuvane. Povežite se s trenerom za individualni plan."
            : "Odaberite šta vam je važno i postavite prve korake."}
        </p>
        <button
          className="primary"
          onClick={() =>
            data.actor.onboarded &&
            data.team.some((person) => person.role === "trainer")
              ? changeView("messages")
              : setModal({
                  kind: data.actor.onboarded ? "acceptInvite" : "onboard",
                })
          }
        >
          {data.actor.onboarded
            ? data.team.some((person) => person.role === "trainer")
              ? "Pošaljite poruku treneru"
              : "Prihvatite poziv"
            : "Uredite moj prostor"}
          <ArrowRight size={16} />
        </button>
      </div>
    );

  return (
    <div className="app">
      {previewId && (
        <div className="preview-banner">
          <strong>Administratorski pregled · bez izmjena</strong>
          <button onClick={() => setPreviewId(null)}>
            Vratite se u administraciju
          </button>
        </div>
      )}
      {notice}
      <a className="skip" href="#main">
        Preskočite na sadržaj
      </a>
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a
          className="brand"
          href="/"
          aria-label="Alda Connect · Početna stranica"
        >
          <Brand />
        </a>
        <button
          className="drawer-close icon-button"
          aria-label="Zatvorite navigaciju"
          onClick={() => setMobile(false)}
        >
          <X size={22} />
        </button>
        <div className="workspace-kind">
          {expert ? "STRUČNI PROSTOR" : "VAŠ PROSTOR"}
        </div>
        <nav aria-label="Glavna navigacija">
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "nav-item active" : "nav-item"}
              aria-current={view === n.id ? "page" : undefined}
              onClick={() => changeView(n.id)}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "queue" &&
                data.tasks.filter((t) => t.status === "open").length > 0 && (
                  <b>{data.tasks.filter((t) => t.status === "open").length}</b>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="mini-label">
            {expert ? "VIŠE FOKUSA" : "VAŠ PUT DO SNAGE"}
          </span>
          <p>
            {expert
              ? "Dobar stručni rad počinje jasnim sljedećim korakom."
              : "Mali koraci. Dosljedan trud. Stvaran napredak."}
          </p>
          <div className="thin-line" />
        </div>
        <div className="sidebar-bottom">
          <button
            className={"nav-item " + (view === "settings" ? "active" : "")}
            onClick={() => changeView("settings")}
          >
            <Settings2 size={19} /> Postavke
          </button>
          <div className="profile">
            <span className={"avatar " + (expert ? "sage" : "peach")}>
              {initials(data.actor.name)}
            </span>
            <span>
              <strong>{data.actor.name}</strong>
              <small>{expert ? "Lični trener" : "Korisnik"}</small>
            </span>
            <button
              className="icon-button"
              aria-label="Odjavite se"
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="backdrop mobile-backdrop"
          aria-label="Zatvorite navigaciju"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(!mobile)}
              aria-label="Otvorite navigaciju"
            >
              <Menu size={22} />
            </button>
            <span>{expert ? "Stručni prostor" : "Vaš prostor"}</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <ThemeControl />
            {!cloud && (
              <button
                className="preview-switch"
                onClick={() => {
                  if (queue.length) {
                    setToast(
                      "Sinhronizujte serije na čekanju ili se odjavite prije promjene profila.",
                    );
                    return;
                  }
                  demo(expert ? "client" : "trainer");
                }}
              >
                {expert ? "Korisnički prikaz" : "Stručni prikaz"}
                <ArrowUpRight size={13} />
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Novosti"
              onClick={() => {
                setView(expert ? "queue" : "messages");
                setToast(
                  expert
                    ? "Vaša lista izvještaja je ažurirana."
                    : "Najnovije obavijesti su u Porukama.",
                );
              }}
            >
              <Bell size={18} />
            </button>
            <span className={"avatar small " + (expert ? "sage" : "peach")}>
              {initials(data.actor.name)}
            </span>
          </div>
        </header>
        <main id="main" className="main">
          <div className="page-heading">
            <div>
              <h1>
                {view === "today"
                  ? `${language === "bs" ? "Dobar dan" : "Dobar dan"}, ${first(data.actor.name)}.`
                  : view === "queue"
                    ? `Pregledan dan, ${first(data.actor.name)}.`
                    : view === "workout"
                      ? "Svako ponavljanje ima smisla."
                      : title}
              </h1>
              <time className="page-date">{dateLabel()}</time>
              <p>
                {view === "today"
                  ? "Malo strukture. Malo podrške. Dan koji vas vodi naprijed."
                  : view === "queue"
                    ? "Pravi zadaci, pravim redom. Usmjerite pažnju tamo gdje je potrebna."
                    : view === "settings"
                      ? "Prilagodite ovaj prostor sebi. Postavke možete promijeniti bilo kada."
                      : view === "clients"
                        ? "Zajednička slika. Individualan pristup."
                        : view === "workout"
                          ? "Krećite se svojim tempom. Serije se čuvaju tokom treninga."
                          : "Vaš plan i ljudi koji vas podržavaju, na jednom mjestu."}
              </p>
            </div>
            {view === "today" ? (
              <button
                className="secondary"
                onClick={() => setModal({ kind: "checkin" })}
              >
                <Plus size={16} /> Kratki izvještaj
              </button>
            ) : expert && view === "clients" ? (
              <button
                className="primary"
                onClick={() => setModal({ kind: "invite" })}
              >
                <Plus size={16} /> Pozovite klijenta
              </button>
            ) : null}
          </div>

          {view === "today" && (
            <>
              <div className="daily-strip">
                <div>
                  <span className="strip-icon">
                    <Sun size={21} />
                  </span>
                  <span>
                    <strong>Danas je pravi trenutak za početak.</strong>
                    <small>
                      {completed > 0
                        ? `${completed} zabilježenih serija. Nastavite svojim tempom.`
                        : "Vaš plan vas čeka."}
                    </small>
                  </span>
                </div>
                <span className="pill sage-pill">
                  <span className="status-dot" />
                  {queue.length
                    ? `${queue.length} serija čeka sinhronizaciju`
                    : "Sve promjene su sačuvane"}
                </span>
              </div>
              <div className="today-grid">
                <section>
                  {selected.includes("training") && <PlanCard />}
                  <div className="section-title">
                    <h2>Svakodnevne navike</h2>
                    <button onClick={() => changeView("settings")}>
                      Prilagodite <Settings2 size={14} />
                    </button>
                  </div>
                  <div className="essentials">
                    {selected.includes("nutrition") && (
                      <button
                        className="essential"
                        onClick={() => changeView("nutrition")}
                      >
                        <span className="round-icon peach-soft">
                          <Leaf size={22} />
                        </span>
                        <strong>Ishrana koja prati vaš dan</strong>
                        <p>
                          {data.diary.filter((d) => d.kind === "meal").length}{" "}
                          obroka zabilježeno · ne morate biti savršeni
                        </p>
                        <span>
                          Dodajte obrok <ArrowUpRight size={16} />
                        </span>
                      </button>
                    )}
                    {selected.includes("recovery") && (
                      <button
                        className="essential"
                        onClick={() => setModal({ kind: "recovery" })}
                      >
                        <span className="round-icon sage-soft">
                          <Heart size={22} />
                        </span>
                        <strong>Poslušajte svoje tijelo</strong>
                        <p>San, energija i kako se danas osjećate</p>
                        <span>
                          Kako se osjećate? <ArrowUpRight size={16} />
                        </span>
                      </button>
                    )}
                  </div>
                </section>
                <aside className="right-rail">
                  <section className="week-card">
                    <div className="section-title">
                      <h2>Sedmica u pokretu</h2>
                      <CalendarDays size={17} />
                    </div>
                    <div className="week-days">
                      {["P", "U", "S", "Č", "P", "S", "N"].map((d, i) => (
                        <div
                          className={
                            i === (today.getDay() + 6) % 7 ? "current" : ""
                          }
                          key={i}
                        >
                          <span>{d}</span>
                          <b>
                            {new Date(
                              monday.getFullYear(),
                              monday.getMonth(),
                              monday.getDate() + i,
                            ).getDate()}
                          </b>
                          {i === (today.getDay() + 6) % 7 ? (
                            <span className="day-dot" />
                          ) : (
                            <i />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="week-note">
                      <span className="small-dot" />
                      Vaš planirani trening{" "}
                      <strong>
                        {completed}/{total} serija
                      </strong>
                    </div>
                    <div className="progress-track">
                      <span
                        style={{
                          width: `${total ? (completed / total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <button
                      className="text-link"
                      onClick={() => changeView("plan")}
                    >
                      Pogledajte plan <ArrowRight size={15} />
                    </button>
                  </section>
                  <section className="coach-note">
                    <span className="eyebrow">UZ VAS</span>
                    <div className="coach-person">
                      <span className="avatar sage">
                        {initials(data.team[0]?.name ?? "Vaš tim")}
                      </span>
                      <span>
                        <strong>
                          {data.team[0]?.name ?? "Vaš tim podrške"}
                        </strong>
                        <small>
                          {data.team.length
                            ? data.team[0]?.role === "doctor"
                              ? "Doktor"
                              : data.team[0]?.role === "trainer"
                                ? "Lični trener"
                                : "Stručna podrška"
                            : "Još niste povezani"}
                        </small>
                      </span>
                      <ShieldCheck size={17} />
                    </div>
                    <p>
                      “
                      {data.messages
                        .filter((m) => m.sender_id !== data.actor.id)
                        .at(-1)?.body ??
                        "Prava podrška počinje povezivanjem. Prihvatite poziv da započnete."}
                      ”
                    </p>
                    <button
                      className="text-link"
                      onClick={() =>
                        data.team.length
                          ? changeView("messages")
                          : setModal({ kind: "acceptInvite" })
                      }
                    >
                      {data.team.length
                        ? "Pošaljite poruku"
                        : "Prihvatite poziv"}
                      <ArrowUpRight size={15} />
                    </button>
                  </section>
                  <div className="quiet-quote">
                    <p>
                      Ne morate uraditi
                      <br />
                      sve.
                      <br />
                      <em>Samo sljedeći korak.</em>
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}

          {view === "workout" && (
            <>
              <button
                className="text-link back-link"
                onClick={() => changeView("today")}
              >
                <ArrowLeft size={16} /> Nazad na vaš dan
              </button>
              {plan ? (
                <div className="workout-layout">
                  <div>
                    <div className="session-heading">
                      <span className="eyebrow">
                        {plan.title} · V{plan.version}
                      </span>
                      <h2>
                        {completed} od {total} zabilježenih serija
                      </h2>
                      <div className="progress-track">
                        <span
                          style={{
                            width: `${total ? (completed / total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    {plan.exercises.map((exercise, i) => (
                      <section className="exercise-block" key={exercise.id}>
                        <header>
                          <span className="exercise-number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <h3>{exercise.name}</h3>
                            <p>
                              {exercise.group} · {exercise.sets} serija ·{" "}
                              {exercise.reps}
                              {isTimed(exercise) ? "" : " ponavljanja"}
                            </p>
                          </div>
                          <Dumbbell size={22} />
                        </header>
                        <p className="exercise-cue">{exercise.cue}</p>
                        <div className="set-table">
                          <div className="set-head">
                            <span>SERIJA</span>
                            <span>TEŽINA · KG</span>
                            <span>
                              {isTimed(exercise) ? "SEKUNDE" : "PONAVLJANJA"}
                            </span>
                            <span>GOTOVO</span>
                          </div>
                          {Array.from({ length: exercise.sets }, (_, index) => {
                            const existing = data.logs.find(
                              (l) =>
                                l.session_id === session?.id &&
                                l.exercise_id === exercise.id &&
                                l.set_index === index,
                            );
                            return (
                              <form
                                className={
                                  "set-row " +
                                  (logged(exercise, index) ? "logged" : "")
                                }
                                key={index}
                                onSubmit={(e) =>
                                  formSubmit(e, async (f) => {
                                    await logSet(
                                      exercise,
                                      index,
                                      Number(f.get("weight")),
                                      Number(f.get("reps")),
                                    );
                                  })
                                }
                              >
                                <span>{index + 1}</span>
                                <input
                                  aria-label={`${exercise.name} serija ${index + 1}, težina`}
                                  name="weight"
                                  type="number"
                                  min={0}
                                  max={1000}
                                  step={0.5}
                                  defaultValue={
                                    existing?.weight ?? exercise.weight
                                  }
                                />
                                <input
                                  aria-label={`${exercise.name} serija ${index + 1}, ${isTimed(exercise) ? "sekunde" : "ponavljanja"}`}
                                  name="reps"
                                  type="number"
                                  min={1}
                                  max={isTimed(exercise) ? 3600 : 200}
                                  defaultValue={
                                    existing?.duration_seconds ??
                                    existing?.reps ??
                                    (isTimed(exercise) ? 30 : 10)
                                  }
                                />
                                <button
                                  className={
                                    "set-check " +
                                    (logged(exercise, index) ? "complete" : "")
                                  }
                                  aria-label={`Sačuvajte: ${exercise.name}, serija ${index + 1}`}
                                  disabled={busy || !session}
                                >
                                  {logged(exercise, index) ? (
                                    <Check size={17} />
                                  ) : (
                                    <Plus size={17} />
                                  )}
                                </button>
                              </form>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                  <aside className="session-aside">
                    <span className="eyebrow">KORAK PO KORAK</span>
                    <h2>
                      Kvalitet prije
                      <br />
                      <em>količine.</em>
                    </h2>
                    <p>
                      Odmorite između serija. Možete napustiti stranicu i
                      vratiti se — sačuvane serije će vas čekati.
                    </p>
                    <div className="quiet-note">
                      <ShieldCheck size={20} />
                      <span>
                        {queue.length
                          ? `${queue.length} serija je sačuvano na ovom uređaju i čeka sinhronizaciju.`
                          : "Završene serije su sačuvane na vašem računu."}
                      </span>
                    </div>
                    {queue.length > 0 && (
                      <button className="secondary" onClick={syncQueue}>
                        Pokušajte ponovo sinhronizovati
                      </button>
                    )}
                    <button
                      className="primary full"
                      disabled={
                        busy || !session || completed === 0 || queue.length > 0
                      }
                      onClick={async () => {
                        try {
                          await mutate(
                            "completeSession",
                            { sessionId: session?.id },
                            "Trening je završen. Historija je sačuvana.",
                          );
                          changeView("today");
                        } catch {}
                      }}
                    >
                      Završite trening <Check size={16} />
                    </button>
                    <button
                      className="secondary full"
                      onClick={() => setModal({ kind: "checkin" })}
                    >
                      Podijelite kako je prošlo <MessageCircle size={16} />
                    </button>
                  </aside>
                </div>
              ) : (
                <PlanCard />
              )}
            </>
          )}

          {(view === "plan" || view === "calendar") && (
            <>
              <div className="plan-header">
                <div>
                  <span className="eyebrow">VAŠ TRENUTNI BLOK</span>
                  <h2>
                    Gradite kontinuitet.
                    <br />
                    <em>Napredak će doći.</em>
                  </h2>
                </div>
                <span className="pill sage-pill">
                  {plan ? "Plan dodijeljen" : "Potrebno postavljanje"}
                </span>
              </div>
              {plan ? (
                <div className="plan-list">
                  {plan.exercises.map((e, i) => (
                    <button
                      className="plan-line"
                      key={e.id}
                      onClick={() => changeView("workout")}
                    >
                      <span className="exercise-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>{e.name}</strong>
                        <small>
                          {e.group} · {e.sets} serija · {e.reps}
                        </small>
                      </div>
                      <span>
                        {
                          data.logs.filter(
                            (l) =>
                              l.plan_id === plan.id && l.exercise_id === e.id,
                          ).length
                        }
                        /{e.sets} serija
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  ))}
                  <footer>
                    <span>
                      Dodijelio/la {plan.author_name} · Verzija {plan.version}
                    </span>
                    <button
                      className="primary"
                      onClick={() => changeView("workout")}
                    >
                      Otvorite trening
                      <ArrowUpRight size={16} />
                    </button>
                  </footer>
                </div>
              ) : (
                <PlanCard />
              )}
              {view === "calendar" && (
                <div className="information">
                  <CalendarDays size={20} />
                  <span>
                    Dostupnost i rezervacija termina su u izradi. Dodijeljeni
                    plan možete pogledati iznad.
                  </span>
                </div>
              )}
            </>
          )}

          {view === "nutrition" && (
            <>
              <div className="nutrition-banner">
                <span className="round-icon peach-soft">
                  <Leaf size={25} />
                </span>
                <div>
                  <span className="eyebrow">VIŠE SVJESNOSTI</span>
                  <h2>Ishrana bez komplikacija.</h2>
                  <p>
                    Zabilježite obrok ili čašu vode. Počnite onim što vam
                    odgovara.
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => setModal({ kind: "meal" })}
                >
                  <Plus size={16} /> Dodajte obrok
                </button>
              </div>
              <div className="metric-grid">
                <div className="metric">
                  <Leaf size={20} />
                  <span>Zabilježeni obroci</span>
                  <strong>
                    {data.diary.filter((d) => d.kind === "meal").length}
                  </strong>
                  <small>Vaši unosi, bez procjene kalorija</small>
                </div>
                <button
                  className="metric"
                  onClick={() =>
                    mutate(
                      "diary",
                      { kind: "water", label: "Čaša vode", value: 250 },
                      "Unos vode je sačuvan.",
                    )
                  }
                >
                  <Droplets size={20} />
                  <span>Zabilježena voda</span>
                  <strong>
                    {data.diary
                      .filter((d) => d.kind === "water")
                      .reduce((s, d) => s + Number(d.value), 0)}
                    <em>ml</em>
                  </strong>
                  <small>
                    Dodajte čašu · 250 ml <Plus size={13} />
                  </small>
                </button>
              </div>
              <div className="section-title">
                <h2>Vaš dnevnik ishrane</h2>
              </div>
              {data.diary.filter((d) => ["meal", "water"].includes(d.kind))
                .length ? (
                <div className="diary-list">
                  {data.diary
                    .filter((d) => ["meal", "water"].includes(d.kind))
                    .map((d) => (
                      <div className="diary-line" key={d.id}>
                        <span className="round-icon sage-soft">
                          {d.kind === "meal" ? (
                            <Leaf size={19} />
                          ) : (
                            <Droplets size={19} />
                          )}
                        </span>
                        <div>
                          <strong>{d.label}</strong>
                          <small>
                            {new Date(d.created_at).toLocaleDateString()} ·{" "}
                            {time(d.created_at)}
                          </small>
                        </div>
                        {d.value && <span>{d.value} ml</span>}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Leaf size={30} />
                  <h3>Novi početak za danas.</h3>
                  <p>Dodajte prvi obrok. Dnevnik ne mora biti savršen.</p>
                </div>
              )}
            </>
          )}

          {view === "medications" &&
            (expert ||
              selected.includes("medications") ||
              Boolean(previewId)) && (
              <MedicationRecords
                key={data.actor.id + clientId}
                clientId={clientId || undefined}
                readOnly={Boolean(previewId)}
              />
            )}

          {view === "labs" &&
            !expert &&
            (selected.includes("labs") || previewId) && (
              <LabRecords key={data.actor.id} readOnly={Boolean(previewId)} />
            )}
          {view === "cycle" &&
            (selected.includes("cycle") || previewId) &&
            !expert && (
              <CycleDiary key={data.actor.id} readOnly={Boolean(previewId)} />
            )}

          {view === "progress" && (
            <>
              <div className="metric-grid">
                <div className="metric">
                  <Dumbbell size={20} />
                  <span>Zabilježene serije</span>
                  <strong>{data.logs.length}</strong>
                  <small>Kroz dodijeljene verzije plana</small>
                </div>
                <div className="metric">
                  <ClipboardList size={20} />
                  <span>Poslani izvještaji</span>
                  <strong>{data.checkins.length}</strong>
                  <small>Kontekst je važan koliko i brojevi</small>
                </div>
                <div className="metric">
                  <Activity size={20} />
                  <span>Trenutni plan</span>
                  <strong>{plan ? `V${plan.version}` : "—"}</strong>
                  <small>
                    {plan
                      ? "Vaša važeća verzija plana"
                      : "Čekamo vašu prvu dodjelu"}
                  </small>
                </div>
              </div>
              <section className="progress-panel">
                <div className="section-title">
                  <div>
                    <span className="eyebrow">
                      MALI KORACI, VIDLJIV NAPREDAK
                    </span>
                    <h2>Posljednji trening, vježbu po vježbu.</h2>
                  </div>
                </div>
                {plan?.exercises.map((e) => {
                  const count = data.logs.filter(
                    (l) =>
                      l.session_id ===
                        data.sessions.find((s) => s.plan_id === plan.id)?.id &&
                      l.exercise_id === e.id,
                  ).length;
                  return (
                    <div className="progress-row" key={e.id}>
                      <strong>{e.name}</strong>
                      <div className="progress-track">
                        <span
                          style={{
                            width: `${Math.min(100, (count / e.sets) * 100)}%`,
                          }}
                        />
                      </div>
                      <span>
                        {count}/{e.sets}
                      </span>
                    </div>
                  );
                })}
                <p className="muted">
                  Na osnovu zabilježenih serija. Izostavljeni unosi se ne
                  računaju kao završeni.
                </p>
              </section>
              <div className="section-title">
                <h2>Historija treninga</h2>
              </div>
              {data.sessions
                .filter((s) => s.completed_at)
                .map((s) => (
                  <article className="checkin-entry" key={s.id}>
                    <div>
                      <span className="pill sage-pill">Završeno</span>
                      <p>{data.plans.find((p) => p.id === s.plan_id)?.title}</p>
                      <small>
                        {new Date(s.completed_at!)
                          .toLocaleDateString("en-GB")
                          .replaceAll("/", ".")}{" "}
                        ·{" "}
                        {data.logs.filter((l) => l.session_id === s.id).length}{" "}
                        zabilježenih serija
                      </small>
                    </div>
                  </article>
                ))}
              {!data.sessions.some((s) => s.completed_at) && (
                <p className="muted">
                  Ovdje će se pojaviti vaši završeni treninzi.
                </p>
              )}
              <div className="section-title">
                <h2>Historija izvještaja</h2>
                <button onClick={() => setModal({ kind: "checkin" })}>
                  Dodajte izvještaj <Plus size={15} />
                </button>
              </div>
              {data.checkins.length ? (
                data.checkins.map((c) => (
                  <article className="checkin-entry" key={c.id}>
                    <div>
                      <span
                        className={
                          "pill " +
                          (c.status === "reviewed" ? "sage-pill" : "peach-pill")
                        }
                      >
                        {c.status === "reviewed"
                          ? "Pregledano"
                          : "Čeka pregled"}
                      </span>
                      <span>
                        Energija {c.energy}/5 · San {c.sleep}h
                      </span>
                    </div>
                    <p>{c.note || "Nema dodatne napomene."}</p>
                    {c.review_note && (
                      <div className="review-note">
                        <strong>Odgovor stručnjaka</strong>
                        <p>{c.review_note}</p>
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <ClipboardList size={25} />
                  <p>Vaš prvi izvještaj će se pojaviti ovdje.</p>
                </div>
              )}
            </>
          )}

          {view === "team" && (
            <>
              <div className="team-intro">
                <span className="eyebrow">LJUDI UZ VAS</span>
                <h2>
                  Prava podrška.
                  <br />
                  <em>Jasne odgovornosti.</em>
                </h2>
                <p>
                  Vi birate ko vas prati. Dodavanje stručnjaka ne dijeli
                  automatski sve vaše podatke.
                </p>
              </div>
              <div className="team-grid">
                {data.team.map((p) => (
                  <article className="team-person" key={p.id}>
                    <span className="avatar large sage">
                      {initials(p.name)}
                    </span>
                    <span className="pill sage-pill">Povezani</span>
                    <h3>{p.name}</h3>
                    <p>Lični trener</p>
                    <div className="team-scope">
                      <ShieldCheck size={17} /> Trening, izvještaji i kontekst
                      stručne podrške
                    </div>
                    <button
                      className="secondary full"
                      onClick={() => changeView("messages")}
                    >
                      Pošaljite poruku <MessageCircle size={16} />
                    </button>
                  </article>
                ))}
                <button
                  className="add-expert"
                  onClick={() => setModal({ kind: "acceptInvite" })}
                >
                  <Plus size={25} />
                  <h3>Povežite se sa stručnjakom</h3>
                  <p>Imate poziv? Povežite se sa svojim trenerom.</p>
                </button>
              </div>
              <div className="information">
                <Clock size={19} />
                <span>
                  Vrijeme odgovora dogovarate sa stručnjakom. Poruke nisu
                  namijenjene hitnim slučajevima.
                </span>
              </div>
            </>
          )}

          {view === "queue" && (
            <>
              <div className="metric-grid trainer-summary">
                <div className="metric">
                  <ClipboardList size={20} />
                  <span>Zahtijeva vašu pažnju</span>
                  <strong>
                    {data.tasks.filter((t) => t.status === "open").length}
                  </strong>
                  <small>Vaši zadaci za pregled</small>
                </div>
                <button
                  className="metric"
                  onClick={() => changeView("clients")}
                >
                  <Users size={20} />
                  <span>Aktivni klijenti</span>
                  <strong>{data.clients.length}</strong>
                  <small>Svaki s individualnim planom</small>
                </button>
                <div className="metric">
                  <Check size={20} />
                  <span>Završeni pregledi</span>
                  <strong>
                    {data.tasks.filter((t) => t.status === "resolved").length}
                  </strong>
                  <small>Jasni sljedeći koraci, zabilježeni</small>
                </div>
              </div>
              <div className="section-title">
                <h2>Vaš sljedeći korak</h2>
                <span className="pill peach-pill">
                  {data.tasks.filter((t) => t.status === "open").length}{" "}
                  otvoreno
                </span>
              </div>
              <section className="queue-table">
                <div className="table-heading">
                  <span>KLIJENT</span>
                  <span>POTREBNA RADNJA</span>
                  <span>STATUS</span>
                  <span />
                </div>
                {data.tasks
                  .filter((t) => t.status === "open")
                  .map((t) => (
                    <div className="queue-row" key={t.id}>
                      <div>
                        <span className="avatar sage">
                          {initials(t.client_name)}
                        </span>
                        <strong>{t.client_name}</strong>
                      </div>
                      <div>
                        <strong>{t.title}</strong>
                        <small>
                          {t.kind === "checkin"
                            ? "Kontekst prije narednog plana."
                            : "Zatražen pregled"}
                        </small>
                      </div>
                      <span className="pill peach-pill">
                        Spremno za pregled
                      </span>
                      <button
                        className="secondary"
                        onClick={async () => {
                          await refresh(t.client_id);
                          setModal({ kind: "review", task: t });
                        }}
                      >
                        Pregledajte <ArrowUpRight size={15} />
                      </button>
                    </div>
                  ))}
                {!data.tasks.some((t) => t.status === "open") && (
                  <div className="empty-state">
                    <Check size={30} />
                    <h3>Trenutak predaha.</h3>
                    <p>Trenutno nema izvještaja za pregled.</p>
                  </div>
                )}
              </section>
              <div className="section-title">
                <h2>Vaši klijenti na jednom mjestu</h2>
                <button onClick={() => changeView("clients")}>
                  Svi klijenti <ArrowRight size={15} />
                </button>
              </div>
              <div className="client-glance">
                {data.clients.map((c) => (
                  <button
                    key={c.id}
                    onClick={async () => {
                      await refresh(c.id);
                      changeView("clients");
                    }}
                  >
                    <span className="avatar peach">{initials(c.name)}</span>
                    <strong>{c.name}</strong>
                    <small>Aktivna saradnja s trenerom</small>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
              </div>
            </>
          )}

          {view === "clients" && (
            <>
              <div className="client-tools">
                <div className="search-field">
                  <Search size={17} />
                  <input
                    placeholder="Pronađite klijenta…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Pronađite klijenta"
                  />
                </div>
                <span>{data.clients.length} aktivnih klijenata</span>
              </div>
              <div className="clients-layout">
                <div className="client-list">
                  {data.clients
                    .filter((c) =>
                      c.name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        className={clientId === c.id ? "selected" : ""}
                        onClick={() => refresh(c.id)}
                      >
                        <span className="avatar peach">{initials(c.name)}</span>
                        <span>
                          <strong>{c.name}</strong>
                          <small>Trening · Aktivno</small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                </div>
                <section className="client-detail">
                  <div className="client-detail-header">
                    <span className="avatar large sage">
                      {initials(client?.name ?? "Korisnik")}
                    </span>
                    <div>
                      <h2>{client?.name}</h2>
                      <p>{client?.email}</p>
                    </div>
                    <span className="pill sage-pill">Aktivno</span>
                  </div>
                  <div className="detail-tabs">
                    <span className="selected">Pregled</span>
                    <button onClick={() => setModal({ kind: "plan" })}>
                      Planiranje treninga
                    </button>
                    <button onClick={() => changeView("messages")}>
                      Poruke
                    </button>
                  </div>
                  <div className="section-title">
                    <h3>Trenutni plan</h3>
                    <button onClick={() => setModal({ kind: "plan" })}>
                      Nova verzija <Plus size={15} />
                    </button>
                  </div>
                  {plan ? (
                    <div className="client-plan">
                      <Dumbbell size={24} />
                      <div>
                        <strong>{plan.title}</strong>
                        <p>
                          {plan.exercises.length} vježbi · Verzija{" "}
                          {plan.version}
                        </p>
                        <small>{plan.reason}</small>
                      </div>
                      <span>
                        {completed}/{total}
                        <small>serija</small>
                      </span>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>Plan još nije dodijeljen.</p>
                      <button
                        className="primary"
                        onClick={() => setModal({ kind: "plan" })}
                      >
                        Kreirajte plan
                      </button>
                    </div>
                  )}
                  <div className="section-title">
                    <h3>Posljednji izvještaj</h3>
                  </div>
                  {data.checkins[0] ? (
                    <div className="client-checkin">
                      <span className="pill peach-pill">
                        {data.checkins[0].status === "reviewed"
                          ? "Pregledano"
                          : "Čeka pregled"}
                      </span>
                      <p>{data.checkins[0].note}</p>
                      <small>
                        Energija {data.checkins[0].energy}/5 · San{" "}
                        {data.checkins[0].sleep}h
                      </small>
                    </div>
                  ) : (
                    <p className="muted">Još nema poslanih izvještaja.</p>
                  )}
                  <div className="section-title">
                    <h3>Historija plana</h3>
                  </div>
                  {data.plans.map((p) => (
                    <div className="version-line" key={p.id}>
                      <span className="version-dot" />
                      <strong>Verzija {p.version}</strong>
                      <span>{p.title}</span>
                      <small>{p.reason}</small>
                    </div>
                  ))}
                </section>
              </div>
            </>
          )}

          {view === "library" && (
            <>
              <div className="library-banner">
                <span className="eyebrow">TEMELJ ZA NAPREDAK</span>
                <h2>
                  Pažljivo osmišljeni programi.
                  <br />
                  <em>Prilagođeni pojedincu.</em>
                </h2>
                <p>
                  Kreirajte novu verziju plana za klijenta. Završeni treninzi
                  ostaju u historiji.
                </p>
              </div>
              <div className="library-grid">
                {[
                  "Donji dio tijela · Snaga i ravnoteža",
                  "Cijelo tijelo · Pronađite svoj ritam",
                  "Gornji dio tijela · Postepena snaga",
                ].map((name, i) => (
                  <button
                    className="library-item"
                    key={name}
                    onClick={() => setModal({ kind: "plan" })}
                  >
                    <span className="library-count">0{i + 1}</span>
                    <Dumbbell size={36} strokeWidth={1} />
                    <h3>{name}</h3>
                    <p>Početni predložak · prilagodite prije objave</p>
                    <span>
                      Pripremite za klijenta <ArrowUpRight size={17} />
                    </span>
                  </button>
                ))}
              </div>
              <div className="information">
                <BookOpen size={19} />
                <span>
                  Početni primjeri sadrže tekstualne upute. Biblioteka
                  provjerenih i licenciranih snimaka vježbi je u planu izrade.
                </span>
              </div>
            </>
          )}

          {view === "messages" && (
            <div className="messages-layout">
              <aside>
                <span className="eyebrow">RAZGOVORI</span>
                {(expert ? data.clients : data.team).map((p) => (
                  <button
                    key={p.id}
                    className={expert && p.id !== clientId ? "" : "selected"}
                    onClick={() => (expert ? refresh(p.id) : null)}
                  >
                    <span className="avatar sage">{initials(p.name)}</span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>{expert ? "Korisnik" : "Vaš trener"}</small>
                    </span>
                  </button>
                ))}
              </aside>
              <section className="conversation">
                <header>
                  <span className="avatar peach">
                    {initials(
                      expert
                        ? (client?.name ?? "Korisnik")
                        : (data.team[0]?.name ?? "Vaš tim"),
                    )}
                  </span>
                  <div>
                    <strong>
                      {expert
                        ? client?.name
                        : (data.team[0]?.name ?? "Nema povezanog stručnjaka")}
                    </strong>
                    <small>
                      Razgovor s trenerom · vrijeme odgovora po dogovoru
                    </small>
                  </div>
                </header>
                <div className="message-feed">
                  {data.messages.map((m) => (
                    <div
                      className={
                        "message " +
                        (m.sender_id === data.actor.id ? "own" : "")
                      }
                      key={m.id}
                    >
                      <small>{m.sender_name}</small>
                      <p>{m.body}</p>
                      <time>{time(m.created_at)}</time>
                    </div>
                  ))}
                  {!data.messages.length && (
                    <div className="empty-state">
                      <MessageCircle size={28} />
                      <p>
                        {expert
                          ? "Započnite razgovor s klijentom."
                          : "Povežite se sa stručnjakom da započnete razgovor."}
                      </p>
                    </div>
                  )}
                </div>
                <form
                  className="message-composer"
                  onSubmit={(e) => {
                    const form = e.currentTarget;
                    formSubmit(e, async (f) => {
                      await mutate(
                        "message",
                        {
                          recipientId: expert ? clientId : data.team[0]?.id,
                          text: f.get("text"),
                        },
                        "Poruka je sačuvana.",
                      );
                      form.reset();
                    });
                  }}
                >
                  <input
                    name="text"
                    required
                    maxLength={2000}
                    placeholder="Napišite poruku…"
                    aria-label="Poruka"
                    disabled={!expert && !data.team.length}
                  />
                  <button
                    className="primary"
                    disabled={busy || (!expert && !data.team.length)}
                    aria-label="Pošaljite poruku"
                  >
                    <ArrowUpRight size={19} />
                  </button>
                </form>
              </section>
            </div>
          )}

          {view === "settings" && (
            <>
              {data.usernameAccount && !previewId && (
                <section className="admin-card">
                  <h2>Lozinka računa</h2>
                  {data.mustChangePassword && (
                    <p>Zamijenite početnu lozinku vlastitom lozinkom.</p>
                  )}
                  <PasswordForm />
                </section>
              )}
              <div className="settings-layout">
                <section>
                  <div className="section-title">
                    <div>
                      <span className="eyebrow">VAŠ PROSTOR, VAŠ IZBOR</span>
                      <h2>Šta želite koristiti?</h2>
                    </div>
                    <span className="pill sage-pill">
                      {active.length} aktivnih modula
                    </span>
                  </div>
                  <p className="settings-description">
                    Odaberite šta vam treba. Isključivanje modula skriva njegov
                    sadržaj, ali ne briše podatke niti mijenja pretplatu.
                  </p>
                  <div className="presets">
                    <button
                      onClick={() =>
                        mutate(
                          "preferences",
                          { modules: ["training", "progress"] },
                          "Postavke treninga su sačuvane.",
                        )
                      }
                    >
                      Fokus na trening
                    </button>
                    <button
                      onClick={() =>
                        mutate(
                          "preferences",
                          {
                            modules: [
                              "training",
                              "nutrition",
                              "progress",
                              "recovery",
                            ],
                          },
                          "Postavke navika su sačuvane.",
                        )
                      }
                    >
                      Svakodnevne navike
                    </button>
                  </div>
                  {["Svakodnevno", "Zdravlje i podrška", "Istražite"].map(
                    (category) => (
                      <div className="module-category" key={category}>
                        <h3>{category}</h3>
                        {modules
                          .filter((m) => m.category === category)
                          .map((m) => {
                            const Icon = iconFor(m.id);
                            return (
                              <div className="module-row" key={m.id}>
                                <span className="round-icon sage-soft">
                                  <Icon size={20} />
                                </span>
                                <div>
                                  <strong>{m.name}</strong>
                                  <p>{m.description}</p>
                                  {!m.available && (
                                    <small>
                                      Planirani modul · još nije aktivan
                                    </small>
                                  )}
                                </div>
                                <button
                                  role="switch"
                                  aria-checked={selected.includes(m.id)}
                                  aria-label={`Uključite: ${m.name}`}
                                  disabled={busy || !m.available}
                                  className={
                                    "toggle " +
                                    (selected.includes(m.id) && m.available
                                      ? "on"
                                      : "")
                                  }
                                  onClick={() =>
                                    mutate(
                                      "preferences",
                                      {
                                        modules: selected.includes(m.id)
                                          ? selected.filter((x) => x !== m.id)
                                          : [...selected, m.id],
                                      },
                                      "Postavke modula su sačuvane.",
                                    )
                                  }
                                >
                                  <span />
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    ),
                  )}
                </section>
                <aside className="settings-aside">
                  <ShieldCheck size={28} />
                  <h3>Izbor nije naplata.</h3>
                  <p>
                    Izbor modula, plaćeni pristup i dijeljenje sa stručnjacima
                    su odvojeni. Ovaj pregled ne vrši naplatu.
                  </p>
                  <hr />
                  <h3>Jezik aplikacije</h3>
                  <select
                    aria-label="Jezik aplikacije"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="bs">Bosanski</option>
                  </select>
                  <small>Osnovni jezik platforme je bosanski.</small>
                  <hr />
                  <button
                    className="secondary full"
                    onClick={() => setModal({ kind: "onboard" })}
                  >
                    Ažurirajte ciljeve
                  </button>
                  <button
                    className="secondary full"
                    disabled={Boolean(previewId)}
                    onClick={async () => {
                      let cycleEntries: unknown[] = [];
                      let medicationRecords: unknown = null;
                      let labRecords: unknown = null;
                      if (data.actor.role === "client") {
                        try {
                          const response = await fetch("/api/cycle", {
                            cache: "no-store",
                          });
                          const result = await response.json();
                          if (!response.ok) throw new Error(result.error);
                          cycleEntries = result.entries;
                          const medications = await fetch("/api/medications", {
                            cache: "no-store",
                          });
                          const records = await medications.json();
                          if (!medications.ok) throw new Error(records.error);
                          medicationRecords = records;
                          const labs = await fetch("/api/labs", {
                            cache: "no-store",
                          });
                          const labData = await labs.json();
                          if (!labs.ok) throw new Error(labData.error);
                          labRecords = {
                            documents: labData.documents,
                            reviews: labData.reviews,
                            team: labData.team,
                            files: "PDF datoteke preuzmite zasebno iz Nalaza.",
                          };
                        } catch {
                          setToast(
                            "Izvoz nije završen. Privatna evidencija nije dostupna; pokušajte ponovo.",
                          );
                          return;
                        }
                      }
                      const blob = new Blob(
                        [
                          JSON.stringify(
                            {
                              actor: data.actor,
                              preferences: data.preferences,
                              plans: data.plans,
                              logs: data.logs,
                              checkins: data.checkins,
                              diary: data.diary,
                              cycleEntries,
                              medicationRecords,
                              labRecords,
                            },
                            null,
                            2,
                          ),
                        ],
                        { type: "application/json" },
                      );
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "fitness-records.json";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Izvezite moje podatke <ArrowUpRight size={15} />
                  </button>
                </aside>
              </div>
            </>
          )}
          <footer className="page-footer">
            <span>Napredak je ličan.</span>
            <span>Alda Connect · Razvojna verzija</span>
          </footer>
        </main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Brza navigacija">
        {nav
          .filter((n) =>
            (expert
              ? ["queue", "clients", "calendar", "messages"]
              : ["today", "plan", "progress", "messages"]
            ).includes(n.id),
          )
          .map((n) => (
            <button
              key={n.id}
              onClick={() => changeView(n.id)}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon size={21} />
              <span>{n.id === "queue" ? "Zadaci" : n.label}</span>
            </button>
          ))}
        <button
          onClick={() => setMobile(!mobile)}
          aria-expanded={mobile}
          aria-label="Više opcija"
        >
          <Menu size={21} />
          <span>Više</span>
        </button>
      </nav>
      {((!data.actor.onboarded && !previewId) || modal) && (
        <div
          className="modal-backdrop"
          onClick={() => data.actor.onboarded && setModal(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            className={"modal " + (modal?.kind === "plan" ? "wide" : "")}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              aria-label="Zatvorite prozor"
              onClick={() => {
                if (!data.actor.onboarded) {
                  setToast("Dovršite postavljanje svog prostora da nastavite.");
                  return;
                }
                setModal(null);
              }}
            >
              <X size={21} />
            </button>
            {!data.actor.onboarded || modal?.kind === "onboard" ? (
              <Onboarding
                selected={selected}
                initial={data.preferences.intake}
                readOnly={Boolean(previewId)}
                busy={busy}
                onSave={async (intake, chosen) => {
                  await mutate(
                    "onboard",
                    { intake, modules: chosen },
                    "Vaš prostor je spreman.",
                  );
                  setModal(null);
                }}
              />
            ) : modal?.kind === "checkin" ? (
              <form
                onSubmit={(e) =>
                  formSubmit(e, async (f) => {
                    await mutate(
                      "checkin",
                      {
                        energy: Number(f.get("energy")),
                        sleep: Number(f.get("sleep")),
                        note: f.get("note"),
                      },
                      "Izvještaj je poslan.",
                    );
                    setModal(null);
                  })
                }
              >
                <span className="eyebrow">TRENUTAK ZA VAS</span>
                <h2 id="dialog-title">Kako protiče vaša sedmica?</h2>
                <p>
                  Malo konteksta pomaže stručnjaku da vam pruži bolju podršku.
                </p>
                <label>
                  Energija
                  <select name="energy" defaultValue="4">
                    <option value="1">1 · Veoma niska</option>
                    <option value="2">2 · Niska</option>
                    <option value="3">3 · Umjerena</option>
                    <option value="4">4 · Dobra</option>
                    <option value="5">5 · Odlična</option>
                  </select>
                </label>
                <label>
                  Prosječno trajanje sna · sati
                  <input
                    name="sleep"
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    defaultValue={7.5}
                    required
                  />
                </label>
                <label>
                  Želite li nešto podijeliti?
                  <textarea
                    name="note"
                    maxLength={2000}
                    placeholder="Šta je prošlo dobro? Šta bi pomoglo naredne sedmice?"
                  />
                </label>
                <button className="primary full" disabled={busy}>
                  Pošaljite izvještaj <ArrowRight size={16} />
                </button>
              </form>
            ) : modal?.kind === "review" ? (
              <form
                onSubmit={(e) =>
                  formSubmit(e, async (f) => {
                    await mutate(
                      "review",
                      { taskId: modal.task?.id, note: f.get("note") },
                      "Pregled je zabilježen.",
                    );
                    setModal(null);
                  })
                }
              >
                <span className="eyebrow">PREGLED IZVJEŠTAJA</span>
                <h2 id="dialog-title">
                  Sljedeći korak za{" "}
                  {first(modal.task?.client_name ?? "vašeg klijenta")}.
                </h2>
                <div className="review-context">
                  {reviewedCheckin?.note ?? "Nema napomene."}
                  <small>
                    Energija {reviewedCheckin?.energy}/5 · San{" "}
                    {reviewedCheckin?.sleep}h
                  </small>
                </div>
                <label>
                  Vaš odgovor
                  <textarea
                    name="note"
                    required
                    maxLength={2000}
                    placeholder="Zabilježite procjenu i dogovoreni sljedeći korak…"
                  />
                </label>
                <button className="primary full" disabled={busy}>
                  Završite pregled <Check size={16} />
                </button>
              </form>
            ) : modal?.kind === "meal" ? (
              <form
                onSubmit={(e) =>
                  formSubmit(e, async (f) => {
                    await mutate(
                      "diary",
                      { kind: "meal", label: f.get("label") },
                      "Obrok je zabilježen.",
                    );
                    setModal(null);
                  })
                }
              >
                <span className="eyebrow">DNEVNIK ISHRANE</span>
                <h2 id="dialog-title">Šta je na vašem tanjiru?</h2>
                <p>Opišite obrok svojim riječima.</p>
                <label>
                  Obrok
                  <textarea
                    required
                    name="label"
                    maxLength={200}
                    placeholder="npr. jaja, integralni hljeb i paradajz"
                  />
                </label>
                <button className="primary full" disabled={busy}>
                  Sačuvajte obrok <Check size={16} />
                </button>
              </form>
            ) : modal?.kind === "recovery" ? (
              <form
                onSubmit={(e) =>
                  formSubmit(e, async (f) => {
                    await mutate(
                      "diary",
                      {
                        kind: "sleep",
                        label: "San",
                        value: Number(f.get("sleep")),
                      },
                      "Oporavak je zabilježen.",
                    );
                    setModal(null);
                  })
                }
              >
                <span className="eyebrow">OPORAVAK</span>
                <h2 id="dialog-title">Odmor je dio plana.</h2>
                <label>
                  Sinoćnji san · sati
                  <input
                    name="sleep"
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    required
                    defaultValue={8}
                  />
                </label>
                <button className="primary full" disabled={busy}>
                  Sačuvajte unos <Check size={16} />
                </button>
              </form>
            ) : modal?.kind === "invite" ? (
              <form
                onSubmit={(e) =>
                  formSubmit(e, async (f) => {
                    const value = await mutate(
                      "invite",
                      { email: f.get("email") },
                      "Poziv je kreiran. E-pošta nije poslana.",
                    );
                    setInviteLink(
                      new URL(
                        "/?invite=" + encodeURIComponent(value.inviteToken),
                        window.location.origin,
                      ).href,
                    );
                  })
                }
              >
                <span className="eyebrow">PROŠIRITE SVOJ TIM KLIJENATA</span>
                <h2 id="dialog-title">Pozovite klijenta.</h2>
                <p>
                  {cloud
                    ? "Kreirajte poziv za odgovarajuću adresu e-pošte. Podijelite link s klijentom. Poziv vrijedi 7 dana; e-pošta s pozivom se ne šalje automatski."
                    : "Kreira lokalni poziv za odgovarajuću izmišljenu adresu. Poruka ne napušta ovaj računar."}
                </p>
                <label>
                  Korisničko ime ili e-pošta klijenta
                  <input
                    name="email"
                    type={cloud ? "text" : "email"}
                    required
                    maxLength={254}
                  />
                </label>
                <button className="primary full" disabled={busy}>
                  Kreirajte poziv <Plus size={16} />
                </button>
                {inviteLink && (
                  <div className="invite-result">
                    <label>
                      Link poziva
                      <input
                        readOnly
                        value={inviteLink}
                        onFocus={(e) => e.target.select()}
                      />
                    </label>
                    <button
                      type="button"
                      className="text-link"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteLink);
                          setToast("Link je kopiran.");
                        } catch {
                          setToast("Označite i kopirajte link iz polja.");
                        }
                      }}
                    >
                      <Copy size={15} /> Kopirajte link
                    </button>
                    <p>
                      Klijent se prijavljuje ili kreira račun istom adresom, a
                      zatim prihvata poziv.
                    </p>
                  </div>
                )}
              </form>
            ) : modal?.kind === "acceptInvite" ? (
              <form
                onSubmit={(e) =>
                  formSubmit(e, async (f) => {
                    await mutate(
                      "acceptInvite",
                      { token: f.get("token") },
                      "Saradnja s trenerom je uspostavljena.",
                    );
                    setInviteToken("");
                    window.history.replaceState(
                      null,
                      "",
                      window.location.pathname,
                    );
                    setModal(null);
                  })
                }
              >
                <span className="eyebrow">VAŠ TIM PODRŠKE</span>
                <h2 id="dialog-title">Povežite se sa svojim trenerom.</h2>
                <p>
                  Poziv mora odgovarati e-pošti vašeg računa. Prihvatanje
                  uspostavlja saradnju s trenerom, bez neograničenog dijeljenja
                  zdravstvenih podataka.
                </p>
                <label>
                  Kod poziva
                  <input name="token" required defaultValue={inviteToken} />
                </label>
                <button className="primary full" disabled={busy}>
                  Prihvatite poziv <ArrowRight size={16} />
                </button>
              </form>
            ) : modal?.kind === "plan" ? (
              <PlanEditor
                plan={plan}
                clients={data.clients}
                clientId={clientId}
                busy={busy}
                onSave={async (target, title, reason, items) => {
                  await mutate(
                    "publishPlan",
                    { clientId: target, title, reason, exercises: items },
                    "Nova verzija plana je objavljena. Historija je sačuvana.",
                  );
                  await refresh(target);
                  setModal(null);
                }}
              />
            ) : null}
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}

function PlanEditor({
  plan,
  clients,
  clientId,
  busy,
  onSave,
}: {
  plan: Plan | undefined;
  clients: Person[];
  clientId: string;
  busy: boolean;
  onSave: (
    clientId: string,
    title: string,
    reason: string,
    items: Exercise[],
  ) => Promise<void>;
}) {
  const [items, setItems] = useState<Exercise[]>(
    plan?.exercises ?? defaultExercises,
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          await onSave(
            String(f.get("clientId")),
            String(f.get("title")),
            String(f.get("reason")),
            items,
          );
        } catch {}
      }}
    >
      <span className="eyebrow">PAŽLJIVO PLANIRANJE TRENINGA</span>
      <h2 id="dialog-title">Pripremite sljedeći korak.</h2>
      <p>
        Objavite novu verziju plana. Završeni treninzi i ranije upute ostaju u
        historiji.
      </p>
      <div className="form-row">
        <label>
          Klijent
          <select name="clientId" defaultValue={clientId}>
            {clients.map((c) => (
              <option value={c.id} key={c.id}>
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
            defaultValue={plan?.title ?? "Cijelo tijelo · Postepeni napredak"}
          />
        </label>
      </div>
      <div className="editor-exercises">
        {items.map((ex, i) => (
          <div key={i} className="editor-row">
            <input
              aria-label={`Naziv vježbe ${i + 1}`}
              value={ex.name}
              onChange={(e) =>
                setItems(
                  items.map((x, n) =>
                    n === i ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
              required
            />
            <label>
              Serije
              <input
                type="number"
                min={1}
                max={10}
                value={ex.sets}
                onChange={(e) =>
                  setItems(
                    items.map((x, n) =>
                      n === i ? { ...x, sets: Number(e.target.value) } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Ponavljanja / trajanje
              <input
                value={ex.reps}
                onChange={(e) =>
                  setItems(
                    items.map((x, n) =>
                      n === i ? { ...x, reps: e.target.value } : x,
                    ),
                  )
                }
                required
              />
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label={`Uklonite vježbu ${i + 1}`}
              disabled={items.length === 1}
              onClick={() => setItems(items.filter((_, n) => n !== i))}
            >
              <X size={17} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="text-link"
        onClick={() =>
          setItems([
            ...items,
            {
              id: crypto.randomUUID(),
              name: "Nova vježba",
              group: "Opće",
              sets: 3,
              reps: "8–10",
              weight: 0,
              cue: "Vježbajte unutar ugodnog opsega pokreta.",
            },
          ])
        }
      >
        <Plus size={15} /> Dodajte vježbu
      </button>
      <label>
        Šta se mijenja i zašto?
        <textarea
          name="reason"
          required
          minLength={3}
          maxLength={500}
          defaultValue={plan?.reason ?? ""}
          placeholder="Objasnite klijentu razlog promjene."
        />
      </label>
      <button className="primary full" disabled={busy || !clients.length}>
        Objavite novu verziju <ArrowUpRight size={17} />
      </button>
    </form>
  );
}
