"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
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
  onSave(intake: Intake, chosen: string[]): Promise<void>;
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
  const steps = [
    "Vaš prostor",
    "Vaši ciljevi",
    ...(chosen.includes("training") ? ["Trening"] : []),
    ...(chosen.includes("nutrition") ? ["Ishrana"] : []),
    ...(chosen.includes("recovery") ? ["Oporavak"] : []),
    "Podrška",
    "Pregled",
  ];
  const [index, setIndex] = useState(0);
  const step = steps[index] ?? "Pregled";
  const last = index === steps.length - 1;
  const [error, setError] = useState("");
  const field = (key: keyof Intake, value: string | number) =>
    setDraft({ ...draft, [key]: value });
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (!last) {
          setIndex(index + 1);
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
            "Nije moguće sačuvati. Provjerite vezu i pokušajte ponovo; uneseni podaci su ostali u ovom prozoru.",
          );
        }
      }}
    >
      <span className="eyebrow">
        PRILAGODIMO PROSTOR VAMA · {index + 1}/{steps.length}
      </span>
      <div
        className="onboard-progress"
        aria-label={`Korak ${index + 1} od ${steps.length}`}
      >
        {steps.map((s, i) => (
          <span className={i <= index ? "done" : ""} key={s} />
        ))}
      </div>
      <h2 id="dialog-title">
        {step === "Vaš prostor"
          ? "Šta vam je važno?"
          : step === "Vaši ciljevi"
            ? "Vaš napredak počinje ovdje."
            : step === "Pregled"
              ? "Spremni za svoj prostor?"
              : step}
      </h2>
      {step === "Vaš prostor" && (
        <>
          <p>
            Odaberite šta vas zanima. Dostupne alate uključujemo odmah; interes
            za module u pripremi čuvamo za kasnije. Izbor možete promijeniti.
          </p>
          <div className="onboard-modules">
            {modules.map((m) => (
              <label
                key={m.id}
                className={chosen.includes(m.id) ? "chosen" : ""}
              >
                <input
                  type="checkbox"
                  checked={chosen.includes(m.id)}
                  onChange={() =>
                    setChosen(
                      chosen.includes(m.id)
                        ? chosen.filter((id) => id !== m.id)
                        : [...chosen, m.id],
                    )
                  }
                />
                <strong>{m.name}</strong>
                <small>{m.description}</small>
                {!m.available && <small>U pripremi · sačuvajte interes</small>}
              </label>
            ))}
          </div>
        </>
      )}
      {step === "Vaši ciljevi" && (
        <>
          <p>
            Postavke služe kao početak razgovora s trenerom. Ne stvaraju
            automatski program.
          </p>
          <label>
            Glavni cilj
            <select
              value={draft.goal}
              onChange={(e) => field("goal", e.target.value)}
            >
              {[
                "Razviti snagu i kontinuitet",
                "Poboljšati opću kondiciju",
                "Izgraditi mišićnu masu",
                "Upravljati tjelesnom masom",
                "Unaprijediti svakodnevno zdravlje i dobrobit",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
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
      {step === "Trening" && (
        <>
          <p>Plan treba odgovarati vašoj sedmici, opremi i iskustvu.</p>
          <div className="form-row">
            <label>
              Dana sedmično
              <input
                type="number"
                required
                min={1}
                max={7}
                value={draft.days}
                onChange={(e) => field("days", Number(e.target.value))}
              />
            </label>
            <label>
              Minuta po treningu
              <input
                type="number"
                required
                min={10}
                max={180}
                step={5}
                value={draft.minutes}
                onChange={(e) => field("minutes", Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            Mjesto treninga
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
      {step === "Ishrana" && (
        <>
          <p>
            Počinjemo s vašim prioritetom. Dnevnik obroka i hidratacije je
            dostupan; stručni jelovnici i detaljno planiranje su u pripremi.
          </p>
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
                "Razgovarati s nutricionistom kada usluga bude dostupna",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </>
      )}
      {step === "Oporavak" && (
        <>
          <p>
            Zabilježite vlastiti cilj sna. Aplikacija ne postavlja dijagnozu
            niti određuje medicinske potrebe.
          </p>
          <label>
            Lični cilj sna · sati
            <input
              type="number"
              min={4}
              max={12}
              step={0.5}
              required
              value={draft.sleepTarget}
              onChange={(e) => field("sleepTarget", Number(e.target.value))}
            />
          </label>
        </>
      )}
      {step === "Podrška" && (
        <>
          <p>
            Možete koristiti vlastiti račun ili prihvatiti poziv trenera. Ovaj
            izbor sam po sebi ne dodjeljuje stručnjaka.
          </p>
          <label>
            Kako želite koristiti platformu?
            <select
              value={draft.support}
              onChange={(e) => field("support", e.target.value)}
            >
              {[
                "Samostalno, uz mogućnost poziva trenera",
                "Imam trenera i prihvatit ću njegov poziv",
                "Želim pronaći stručnu podršku kada bude dostupna",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <p className="quiet-note">
            Zdravstveni nalazi, menstrualni podaci i evidencija lijekova
            prikupljat će se tek u odgovarajućim stručnim tokovima uz jasne
            dozvole. Trenutno ih ne unosite ovdje.
          </p>
        </>
      )}
      {step === "Pregled" && (
        <>
          <div className="onboard-summary">
            <p>
              <strong>Cilj</strong>
              {draft.goal}
            </p>
            <p>
              <strong>Trening</strong>
              {chosen.includes("training")
                ? `${draft.days} dana · ${draft.minutes} min · ${draft.setting}`
                : "Nije odabran"}
            </p>
            <p>
              <strong>Dostupni alati</strong>
              {modules
                .filter((m) => m.available && chosen.includes(m.id))
                .map((m) => m.name)
                .join(", ") || "Nijedan — izbor možete promijeniti kasnije"}
            </p>
            <p>
              <strong>Interes za kasnije</strong>
              {modules
                .filter((m) => !m.available && chosen.includes(m.id))
                .map((m) => m.name)
                .join(", ") || "Nema dodatnih modula"}
            </p>
          </div>
          <p>
            Sačuvat ćemo vaše postavke. Ovim ne nastaje pretplata niti trošak.
            Stručni program se dodjeljuje zasebno.
          </p>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="onboard-actions">
        {index > 0 && (
          <button
            className="text-link"
            type="button"
            disabled={busy}
            onClick={() => setIndex(index - 1)}
          >
            <ArrowLeft size={16} /> Nazad
          </button>
        )}
        <button className="primary" disabled={busy || (last && readOnly)}>
          {busy ? "Čuvamo…" : last ? "Kreirajte moj prostor" : "Nastavite"}
          {last ? <Check size={16} /> : <ArrowRight size={16} />}
        </button>
      </div>
    </form>
  );
}
