"use client";
import { useRef, useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Dumbbell,
  Flame,
  ChartNoAxesCombined,
  Heart,
  Target,
  LoaderCircle,
} from "lucide-react";
import { modules } from "@/lib/domain";
type Intake = {
  goal: string;
  days: number;
  setting: string;
  experience: string;
  minutes: number;
  nutrition: string;
  sleepTarget: number;
  support: string;
  requestedModules: string[];
  schemaVersion: number;
};
const goals = [
  {
    title: "Snaga i kontinuitet",
    value: "Razviti snagu i kontinuitet",
    note: "Gradite naviku koja traje.",
  },
  {
    title: "Bolja kondicija",
    value: "Poboljšati opću kondiciju",
    note: "Više energije za svaki dan.",
  },
  {
    title: "Mišićna masa",
    value: "Izgraditi mišićnu masu",
    note: "Postepen, dosljedan napredak.",
  },
  {
    title: "Tjelesna masa",
    value: "Upravljati tjelesnom masom",
    note: "Pronađite ravnotežu koja vam odgovara.",
  },
];
const tools = [
  {
    id: "training",
    name: "Trening",
    note: "Vaš plan i zabilježene serije",
    icon: Dumbbell,
  },
  {
    id: "nutrition",
    name: "Ishrana",
    note: "Obroci, barkodovi i hidratacija",
    icon: Flame,
  },
  {
    id: "progress",
    name: "Napredak",
    note: "Pregled vaše dosljednosti",
    icon: ChartNoAxesCombined,
  },
  {
    id: "recovery",
    name: "Oporavak",
    note: "San i svakodnevni osjećaj",
    icon: Heart,
  },
];
export default function Onboarding({
  selected,
  initial,
  busy,
  readOnly = false,
  onSave,
}: {
  selected: string[];
  initial?: Record<string, unknown>;
  busy: boolean;
  readOnly?: boolean;
  onSave: (intake: Intake, chosen: string[]) => Promise<void>;
}) {
  const [chosen, setChosen] = useState<string[]>(
    Array.isArray(initial?.requestedModules)
      ? (initial.requestedModules as string[])
      : selected,
  );
  const [draft, setDraft] = useState<Intake>({
    goal: "Razviti snagu i kontinuitet",
    days: 3,
    setting: "Teretana",
    experience: "Početnik",
    minutes: 45,
    nutrition: "Izgraditi redovne navike",
    sleepTarget: 8,
    support: "Samostalno, uz mogućnost poziva trenera",
    requestedModules: [],
    schemaVersion: 2,
    ...initial,
  } as Intake);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    title.current?.closest(".modal")?.scrollTo({ top: 0 });
  }, [step]);
  const field = (key: keyof Intake, value: string | number) =>
    setDraft((d) => ({ ...d, [key]: value }));
  return (
    <form
      className="onboarding-clean"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (step < 2) {
          setStep((s) => s + 1);
          return;
        }
        try {
          await onSave(
            { ...draft, requestedModules: chosen, schemaVersion: 2 },
            chosen.filter((id) =>
              modules.some((m) => m.id === id && m.available),
            ),
          );
        } catch {
          setError(
            "Postavke nisu sačuvane. Provjerite vezu i pokušajte ponovo.",
          );
        }
      }}
    >
      <div className="onboarding-top">
        <span className="sheet-kicker">VAŠ POČETAK</span>
        <span>{step + 1} / 3</span>
      </div>
      <div className="onboard-progress" aria-label={`Korak ${step + 1} od 3`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i <= step ? "done" : ""} />
        ))}
      </div>
      <h2 id="dialog-title" tabIndex={-1} ref={title}>
        {
          ["Šta vas pokreće?", "Pronađimo vaš ritam.", "Neka bude baš vaše."][
            step
          ]
        }
      </h2>
      <p className="onboarding-subtitle">
        {
          [
            "Odaberite svoj glavni cilj. Sve možete prilagoditi kasnije.",
            "Trening treba stati u vaš život. Počnimo od sedmice koja vam odgovara.",
            "Uključite alate koje želite koristiti. Ostalo vas čeka u postavkama.",
          ][step]
        }
      </p>
      <fieldset disabled={busy || readOnly} className="onboarding-fields">
        {step === 0 && (
          <>
            <div
              className="onboarding-goals"
              role="radiogroup"
              aria-label="Glavni cilj"
            >
              {goals.map((g) => (
                <label
                  key={g.value}
                  className={draft.goal === g.value ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="goal"
                    value={g.value}
                    checked={draft.goal === g.value}
                    onChange={() => field("goal", g.value)}
                  />
                  <span>
                    <strong>{g.title}</strong>
                    <small>{g.note}</small>
                  </span>
                  <span className="onboarding-check">
                    {draft.goal === g.value ? (
                      <Check size={14} />
                    ) : (
                      <Target size={14} />
                    )}
                  </span>
                </label>
              ))}
            </div>
            <label>
              Iskustvo s treningom
              <select
                value={draft.experience}
                onChange={(e) => field("experience", e.target.value)}
              >
                {[
                  "Početnik",
                  "Povremeno treniram",
                  "Redovno treniram",
                  "Napredni nivo",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {step === 1 && (
          <>
            <label className="onboarding-field-title">
              Koliko dana sedmično?
            </label>
            <div
              className="onboarding-days"
              role="group"
              aria-label="Dana treninga sedmično"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={draft.days === d}
                  onClick={() => field("days", d)}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="onboarding-quiet">
              {draft.days} {draft.days === 1 ? "dan" : "dana"} sedmično ·
              prilagodite kad god želite
            </p>
            <label>
              Vrijeme za jedan trening
              <select
                value={draft.minutes}
                onChange={(e) => field("minutes", Number(e.target.value))}
              >
                {[15, 20, 30, 45, 60, 75, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} minuta
                  </option>
                ))}
                {![15, 20, 30, 45, 60, 75, 90].includes(draft.minutes) && (
                  <option value={draft.minutes}>{draft.minutes} minuta</option>
                )}
              </select>
            </label>
            <label>
              Gdje najčešće trenirate?
              <select
                value={draft.setting}
                onChange={(e) => field("setting", e.target.value)}
              >
                {["Teretana", "Kod kuće", "Na otvorenom", "Kombinovano"].map(
                  (v) => (
                    <option key={v}>{v}</option>
                  ),
                )}
              </select>
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <div className="onboarding-tools">
              {tools.map(({ id, name, note, icon: Icon }) => (
                <label
                  className={chosen.includes(id) ? "selected" : ""}
                  key={id}
                >
                  <span className="onboarding-tool-icon">
                    <Icon size={21} />
                  </span>
                  <span>
                    <strong>{name}</strong>
                    <small>{note}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={chosen.includes(id)}
                    onChange={() =>
                      setChosen((c) =>
                        c.includes(id) ? c.filter((v) => v !== id) : [...c, id],
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <details className="onboarding-options">
              <summary>
                Dodatne postavke <span>Opcionalno</span>
              </summary>
              <label>
                Prioritet u ishrani
                <select
                  value={draft.nutrition}
                  onChange={(e) => field("nutrition", e.target.value)}
                >
                  {[
                    "Izgraditi redovne navike",
                    "Pratiti obroke i hidrataciju",
                    "Podržati trening i oporavak",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Lični cilj sna · sati
                <input
                  type="number"
                  inputMode="decimal"
                  min={4}
                  max={12}
                  step={0.5}
                  value={draft.sleepTarget}
                  onChange={(e) => field("sleepTarget", Number(e.target.value))}
                />
              </label>
              {modules
                .filter(
                  (m) =>
                    !["training", "nutrition", "progress", "recovery"].includes(
                      m.id,
                    ) && m.available,
                )
                .map((m) => (
                  <label className="onboarding-extra" key={m.id}>
                    <input
                      type="checkbox"
                      checked={chosen.includes(m.id)}
                      onChange={() =>
                        setChosen((c) =>
                          c.includes(m.id)
                            ? c.filter((v) => v !== m.id)
                            : [...c, m.id],
                        )
                      }
                    />
                    <span>
                      {m.name}
                      <small>{m.description}</small>
                    </span>
                  </label>
                ))}
            </details>
            <div className="onboarding-recap">
              <Check size={17} />
              <span>
                {draft.days} dana · {draft.minutes} min · {draft.setting}
                <small>
                  Vaš izbor je početak. Trener dodjeljuje program zasebno.
                </small>
              </span>
            </div>
            <p className="onboarding-quiet">
              Poziv trenera možete prihvatiti nakon postavljanja računa. Vi
              odlučujete kada se povezujete.
            </p>
          </>
        )}
      </fieldset>
      {error && (
        <p className="food-error" role="alert">
          {error}
        </p>
      )}
      <div className="onboard-actions">
        {step > 0 && (
          <button
            className="text-link"
            type="button"
            disabled={busy}
            onClick={() => setStep((s) => s - 1)}
          >
            <ArrowLeft size={16} /> Nazad
          </button>
        )}
        <button className="primary" disabled={busy || readOnly}>
          {busy ? (
            <LoaderCircle className="spinning" size={17} />
          ) : step === 2 ? (
            <Check size={17} />
          ) : (
            <ArrowRight size={17} />
          )}{" "}
          {busy ? "Čuvamo…" : step === 2 ? "Otvorite moj prostor" : "Nastavite"}
        </button>
      </div>
    </form>
  );
}
