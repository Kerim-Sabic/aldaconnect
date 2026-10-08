"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  bleedingLabels,
  cycleLabels,
  cycleSymptoms,
  sarajevoDay,
  type CycleEntry,
} from "@/lib/cycle";

const emptyEntry = (): CycleEntry => ({
  id: crypto.randomUUID(),
  date: sarajevoDay(),
  bleeding: "none",
  pain: null,
  symptoms: [],
  note: "",
});

export default function CycleDiary({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const [entries, setEntries] = useState<CycleEntry[]>([]);
  const [draft, setDraft] = useState<CycleEntry | null>(null);
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (readOnly) return;
    const abort = new AbortController();
    fetch("/api/cycle", { cache: "no-store", signal: abort.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        return body;
      })
      .then((body) => {
        setEntries(body.entries);
        setDraft(
          body.entries.find(
            (row: CycleEntry) => row.date === sarajevoDay() && !row.removed_at,
          ) ?? emptyEntry(),
        );
        setReady(true);
      })
      .catch((e) => {
        if (!abort.signal.aborted)
          setError(e.message || "Dnevnik trenutno nije dostupan.");
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [readOnly]);

  async function mutate(
    action: "save" | "remove" | "restore",
    entry: CycleEntry,
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          payload: action === "save" ? entry : { id: entry.id },
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setEntries(body.entries);
      setDraft(
        body.entries.find(
          (row: CycleEntry) => row.date === sarajevoDay() && !row.removed_at,
        ) ?? emptyEntry(),
      );
      setNotice(
        action === "remove"
          ? "Unos je uklonjen. Možete ga vratiti iz uklonjenih unosa."
          : action === "restore"
            ? "Unos je vraćen."
            : "Unos je sačuvan.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Promjene nisu sačuvane.");
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (draft) void mutate("save", draft);
  }
  if (readOnly)
    return (
      <section className="progress-panel">
        <h2>Ciklus i simptomi</h2>
        <p>
          Privatni dnevnik dostupan je samo vlasniku klijentskog računa.
          Administratorski pregled ne učitava lične unose.
        </p>
      </section>
    );
  return (
    <section className="cycle-diary">
      <div className="section-title">
        <div>
          <span className="eyebrow">VAŠ PRIVATNI DNEVNIK</span>
          <h2>Privatni dnevnik</h2>
        </div>
      </div>
      <p className="muted">
        Bilježite vlastito iskustvo. Unosi se ne prikazuju treneru niti u
        administratorskom pregledu. Dnevnik ne predviđa ovulaciju i ne mijenja
        vaš trening automatski.
      </p>
      {error && (
        <p role="alert">
          {error}{" "}
          {!ready && (
            <button onClick={() => location.reload()}>Pokušajte ponovo</button>
          )}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {busy && !ready && <p role="status">Učitavanje dnevnika…</p>}
      {draft && ready && (
        <form className="progress-panel cycle-form" onSubmit={submit}>
          <h3>
            {entries.some((e) => e.id === draft.id)
              ? "Uredite unos"
              : "Dnevni unos"}
          </h3>
          <label>
            Datum
            <input
              type="date"
              required
              min="1900-01-01"
              max={sarajevoDay()}
              value={draft.date}
              disabled={busy}
              onChange={(e) => {
                const existing = entries.find(
                  (row) => row.date === e.target.value,
                );
                setDraft(
                  existing
                    ? { ...existing }
                    : { ...emptyEntry(), date: e.target.value },
                );
              }}
            />
          </label>
          <label>
            Krvarenje
            <select
              value={draft.bleeding}
              disabled={busy}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  bleeding: e.target.value as CycleEntry["bleeding"],
                })
              }
            >
              {Object.entries(bleedingLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Bol (0–10, opcionalno)
            <input
              type="number"
              min="0"
              max="10"
              step="1"
              value={draft.pain ?? ""}
              disabled={busy}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  pain: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <fieldset disabled={busy}>
            <legend>Simptomi (opcionalno)</legend>
            <div className="cycle-symptoms">
              {cycleSymptoms.map((id) => (
                <label key={id}>
                  <input
                    type="checkbox"
                    checked={draft.symptoms.includes(id)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        symptoms: e.target.checked
                          ? [...draft.symptoms, id]
                          : draft.symptoms.filter((s) => s !== id),
                      })
                    }
                  />
                  {cycleLabels[id]}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Bilješka (opcionalno)
            <textarea
              maxLength={1000}
              value={draft.note}
              disabled={busy}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </label>
          <div className="cycle-actions">
            <button className="primary-button" disabled={busy}>
              {busy ? "Čuvanje…" : "Sačuvajte unos"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                setDraft(
                  entries.find(
                    (row) => row.date === sarajevoDay() && !row.removed_at,
                  ) ?? emptyEntry(),
                )
              }
            >
              Novi unos
            </button>
          </div>
        </form>
      )}
      <h3>Historija</h3>
      {ready && !entries.some((e) => !e.removed_at) && (
        <p>Još nema unosa. Započnite kada vam odgovara.</p>
      )}
      {entries
        .filter((e) => !e.removed_at)
        .map((entry) => (
          <article className="checkin-entry" key={entry.id}>
            <div>
              <strong>{entry.date.split("-").reverse().join(".")}</strong>
              <p>
                {bleedingLabels[entry.bleeding]}
                {entry.pain !== null ? ` · Bol ${entry.pain}/10` : ""}
              </p>
              <p>{entry.symptoms.map((s) => cycleLabels[s]).join(" · ")}</p>
              {entry.note && (
                <p style={{ whiteSpace: "pre-wrap" }}>{entry.note}</p>
              )}
              <div className="cycle-actions">
                <button
                  disabled={busy}
                  onClick={() => {
                    setDraft({ ...entry });
                    setNotice("");
                  }}
                >
                  Uredite
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Ukloniti ovaj unos iz historije? Možete ga kasnije vratiti.",
                      )
                    )
                      void mutate("remove", entry);
                  }}
                >
                  Uklonite
                </button>
              </div>
            </div>
          </article>
        ))}
      {entries.some((e) => e.removed_at) && (
        <details>
          <summary>Uklonjeni unosi</summary>
          <p className="muted">
            Uklanjanje iz historije nije trajno brisanje. Ovdje možete vratiti
            uklonjeni unos.
          </p>
          {entries
            .filter((e) => e.removed_at)
            .map((entry) => (
              <p key={entry.id}>
                {entry.date.split("-").reverse().join(".")}{" "}
                <button
                  disabled={busy}
                  onClick={() => void mutate("restore", entry)}
                >
                  Vratite unos
                </button>
              </p>
            ))}
        </details>
      )}
    </section>
  );
}
