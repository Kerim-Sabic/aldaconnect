"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { focusScope } from "./focus-scope";
import Brand from "./brand";
import ThemeControl from "./theme-control";
import { dayKey, nutritionTotals } from "@/lib/nutrition";
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
const Nutrition = dynamic(() => import("./nutrition"), {
  loading: moduleLoading,
});
const MealComposer = dynamic(
  () => import("./nutrition").then((m) => m.MealComposer),
  { loading: moduleLoading },
);
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
  Camera,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  Droplets,
  Dumbbell,
  Heart,
  Flame,
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
    Number(part("day")) +
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
    window.scrollTo(0, 0);
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [view]);
  const dialogRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const dialogOpen = Boolean(
    data && ((!data.actor.onboarded && !previewId) || modal),
  );
  const canDismissDialog = Boolean(data?.actor.onboarded);
  useEffect(() => {
    if (!dialogOpen || !dialogRef.current) return;
    return focusScope(dialogRef.current, () => {
      if (canDismissDialog) setModal(null);
    });
  }, [dialogOpen, canDismissDialog]);
  useEffect(() => {
    if (!mobile || !drawerRef.current) return;
    const media = matchMedia("(max-width: 768px)");
    if (!media.matches) return;
    const release = focusScope(drawerRef.current, () => setMobile(false));
    const resized = () => {
      if (!media.matches) setMobile(false);
    };
    media.addEventListener("change", resized);
    return () => {
      release();
      media.removeEventListener("change", resized);
    };
  }, [mobile]);
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
          <section className="entry-intro">
            <span className="entry-kicker">
              <span className="status-dot" /> VAŠ PROSTOR ZA NAPREDAK
            </span>
            <h1>
              Vaš dan.
              <br />
              <em>Vaš tempo.</em>
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
            <div
              className="entry-photograph"
              role="img"
              aria-label="Mirno osvijetljen prostor za trening s girjom"
            />
          </section>
          <section className="entry-panel" aria-label="Pristup vašem računu">
            <div className="tabs">
              {(cloud
                ? (["login", "register"] as const)
                : (["demo", "login", "register"] as const)
              ).map((x) => (
                <button
                  className={auth === x ? "active" : ""}
                  aria-pressed={auth === x}
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
                <h2>Dobro došli.</h2>
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
        { id: "nutrition", label: "Ishrana", icon: Flame },
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
  const foodToday = nutritionTotals(data.diary, dayKey());
  const descriptions: Record<string, string> = {
    today: "Vaš trening i svakodnevne navike, na jednom mjestu.",
    queue: "Izvještaji, klijenti i sljedeći koraci.",
    settings: "Prilagodite module i postavke svog prostora.",
    clients: "Planovi, izvještaji i poruke vaših klijenata.",
    workout: "Serije se čuvaju tokom treninga. Nastavite svojim tempom.",
    plan: "Vaš dodijeljeni plan i zabilježeni treninzi.",
    progress: "Pregled vaših treninga, serija i izvještaja.",
    team: "Stručnjaci s kojima ste povezani.",
    messages: expert
      ? "Razgovori s vašim klijentima."
      : "Razgovori s vašim timom.",
    nutrition: "Jednostavan pregled vaših obroka i kalorija.",
    cycle: "Vaše bilješke, dostupne samo vama.",
    medications: "Evidencija s autorima i historijom izmjena.",
    labs: "Testni nalazi i pregled uz vašu dozvolu.",
    calendar: "Pregled vaše sedmice.",
    library: "Vježbe i programi za pripremu planova.",
  };
  const planCard = plan ? (
    <div className="workout-feature">
      <div className="workout-caption">
        <span>
          <Dumbbell size={17} /> VAŠ TRENING
        </span>
        <span className="workout-version">Verzija {plan.version}</span>
      </div>
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
              <Dumbbell size={15} /> {plan.exercises.length} vježbi
            </span>
            <span>{total} serija</span>
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
        <div
          className="session-ring"
          role="img"
          aria-label={`${completed} od ${total} serija zabilježeno`}
        >
          <svg viewBox="0 0 140 140" aria-hidden="true">
            <circle className="ring-track" cx="70" cy="70" r="59" />
            <circle
              className="ring-value"
              cx="70"
              cy="70"
              r="59"
              pathLength="100"
              strokeDasharray={`${total ? Math.min(100, (completed / total) * 100) : 0} 100`}
            />
          </svg>
          <span>
            <strong>
              {completed}
              <small>/{total}</small>
            </strong>
            <span>serija</span>
          </span>
        </div>
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
      <div className="feature-footer">
        <span>
          <span className="avatar tiny sage">{initials(plan.author_name)}</span>
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
    <div className="app" data-view={view}>
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
      <aside
        ref={drawerRef}
        tabIndex={-1}
        className={"sidebar " + (mobile ? "open" : "")}
      >
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
              className={
                view === n.id || (view === "workout" && n.id === "plan")
                  ? "nav-item active"
                  : "nav-item"
              }
              aria-current={
                view === n.id || (view === "workout" && n.id === "plan")
                  ? "page"
                  : undefined
              }
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
              aria-expanded={mobile}
            >
              <Menu size={22} />
            </button>
            <span>{expert ? "Stručni prostor" : "Vaš prostor"}</span>
            <span className="mobile-brand">
              <Brand />
            </span>
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
        <main id="main" className="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <h1>
                {view === "today"
                  ? `${language === "bs" ? "Dobar dan" : "Dobar dan"}, ${first(data.actor.name)}.`
                  : view === "queue"
                    ? `Dobar dan, ${first(data.actor.name)}.`
                    : view === "workout"
                      ? "Vaš trening"
                      : title}
              </h1>
              <time className="page-date">{dateLabel()}</time>
              <p>{descriptions[view]}</p>
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
            <div className="day-layout">
              <div className="day-primary">
                <div className="day-week" aria-label="Ova sedmica">
                  {["P", "U", "S", "Č", "P", "S", "N"].map((day, index) => (
                    <div
                      key={index}
                      className={
                        index === (today.getDay() + 6) % 7 ? "is-today" : ""
                      }
                    >
                      <span>{day}</span>
                      <strong>
                        {new Date(
                          monday.getFullYear(),
                          monday.getMonth(),
                          monday.getDate() + index,
                        ).getDate()}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="food-section-heading">
                  <h2>Vaš sljedeći korak</h2>
                  <span>{session ? "U toku" : "Trening"}</span>
                </div>
                {selected.includes("training") && planCard}
                <div className="day-quick-actions">
                  <button onClick={() => setModal({ kind: "scanMeal" })}>
                    <Camera size={19} />
                    <span>Skenirajte obrok</span>
                    <ArrowUpRight size={16} />
                  </button>
                  <button onClick={() => setModal({ kind: "checkin" })}>
                    <Plus size={19} />
                    <span>Kratki izvještaj</span>
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
              <div className="day-secondary">
                <div className="food-section-heading">
                  <h2>Ishrana danas</h2>
                  <button
                    className="text-link"
                    onClick={() => changeView("nutrition")}
                  >
                    Dnevnik <ArrowRight size={15} />
                  </button>
                </div>
                <div className="day-nutrition-bento">
                  <section className="day-calories">
                    <span className="calorie-label">
                      <Flame size={17} /> Unesene kalorije
                    </span>
                    <div className="calorie-number">
                      {foodToday.calories.toLocaleString("bs-BA")}
                      <span>kcal</span>
                    </div>
                    <p>
                      {foodToday.meals.length
                        ? `Obroci danas: ${foodToday.meals.length}`
                        : "Vaš prvi obrok počinje ovdje."}
                    </p>
                    <button
                      className="primary full"
                      onClick={() => setModal({ kind: "meal" })}
                    >
                      <Plus size={17} /> Dodajte obrok
                    </button>
                  </section>
                  <button
                    className="day-water"
                    disabled={busy}
                    onClick={() => {
                      void mutate(
                        "diary",
                        { kind: "water", label: "Čaša vode", value: 250 },
                        "Dodano 250 ml vode.",
                      ).catch(() => {});
                    }}
                  >
                    <Droplets size={19} />
                    <span>
                      <strong>Hidratacija</strong>
                      <small>{foodToday.water} ml danas</small>
                    </span>
                    <span className="water-add">+ 250 ml</span>
                  </button>
                </div>
                <div className="food-section-heading">
                  <h2>Vaš tim</h2>
                  <button
                    className="text-link"
                    onClick={() => changeView("team")}
                  >
                    Svi <ArrowRight size={15} />
                  </button>
                </div>
                <button
                  className="day-team"
                  onClick={() =>
                    data.team.length
                      ? changeView("messages")
                      : setModal({ kind: "acceptInvite" })
                  }
                >
                  <span className="avatar">
                    {initials(data.team[0]?.name ?? "Vaš tim")}
                  </span>
                  <span>
                    <strong>
                      {data.team[0]?.name ?? "Povežite se sa stručnjakom"}
                    </strong>
                    <small>
                      {data.team.length
                        ? "Pošaljite poruku"
                        : "Prihvatite poziv svog tima"}
                    </small>
                  </span>
                  <MessageCircle size={19} />
                </button>
                {queue.length > 0 && (
                  <p className="food-footnote" role="status">
                    {queue.length} serija čeka sinhronizaciju.
                  </p>
                )}
              </div>
              <section className="day-activity">
                <div className="food-section-heading">
                  <h2>Vaša aktivnost</h2>
                  <button
                    className="text-link"
                    onClick={() => changeView("progress")}
                  >
                    Pregled <ArrowRight size={15} />
                  </button>
                </div>
                <div className="day-stats">
                  <div>
                    <span>Treninzi</span>
                    <strong>
                      {data.sessions.filter((s) => s.completed_at).length}
                    </strong>
                    <small>završeno ukupno</small>
                  </div>
                  <div>
                    <span>Serije</span>
                    <strong>
                      {completed}
                      <em> / {total}</em>
                    </strong>
                    <small>u aktivnom planu</small>
                  </div>
                  <div>
                    <span>Izvještaji</span>
                    <strong>{data.checkins.length}</strong>
                    <small>poslano vašem timu</small>
                  </div>
                </div>
              </section>
            </div>
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
                planCard
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
                planCard
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
            <Nutrition
              entries={data.diary}
              busy={busy}
              readOnly={Boolean(previewId)}
              onAdd={(camera) =>
                setModal({ kind: camera ? "scanMeal" : "meal" })
              }
              onWater={() =>
                mutate(
                  "diary",
                  { kind: "water", label: "Čaša vode", value: 250 },
                  "Dodano 250 ml vode.",
                )
              }
            />
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
                        <strong>
                          {t.title === "Weekly check-in ready to review"
                            ? "Sedmični izvještaj je spreman za pregled"
                            : t.title}
                        </strong>
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
                <section className="settings-card">
                  <div className="settings-app-tools">
                    <div>
                      <strong>Izgled aplikacije</strong>
                      <ThemeControl />
                    </div>
                    <button
                      className="secondary"
                      onClick={() =>
                        window.dispatchEvent(new Event("alda-install"))
                      }
                    >
                      Dodajte aplikaciju na telefon <ArrowUpRight size={15} />
                    </button>
                  </div>
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
              : ["today", "plan", "nutrition", "messages"]
            ).includes(n.id),
          )
          .map((n) => (
            <button
              key={n.id}
              onClick={() => changeView(n.id)}
              aria-current={
                view === n.id || (view === "workout" && n.id === "plan")
                  ? "page"
                  : undefined
              }
            >
              <n.icon size={21} />
              <span>{n.id === "queue" ? "Zadaci" : n.label}</span>
            </button>
          ))}
        <button
          onClick={() => setMobile(!mobile)}
          aria-expanded={mobile}
          aria-current={
            !(
              expert
                ? ["queue", "clients", "calendar", "messages"]
                : ["today", "plan", "nutrition", "messages", "workout"]
            ).includes(view)
              ? "page"
              : undefined
          }
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
            ref={dialogRef}
            tabIndex={-1}
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
            ) : modal?.kind === "meal" || modal?.kind === "scanMeal" ? (
              <MealComposer
                camera={modal.kind === "scanMeal"}
                entries={data.diary}
                busy={busy}
                onSave={async (label, calories) => {
                  await mutate(
                    "diary",
                    { kind: "meal", label, value: calories },
                    "Obrok je sačuvan.",
                  );
                  setModal(null);
                }}
              />
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
