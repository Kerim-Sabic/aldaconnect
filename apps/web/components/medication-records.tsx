"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  categoryLabels,
  statusLabels,
  recordLabels,
  type MedicationContent,
  type MedicationData,
  type MedicationRecord,
} from "@/lib/medications";
const newContent = (): MedicationContent => ({
  category: "supplement",
  name: "",
  dose: "",
  route: "",
  frequency: "",
  timing: "",
  note: "",
  status: "active",
  start: "",
  end: "",
});
const roleName = (role: string) =>
  role === "doctor" ? "Doktor" : role === "trainer" ? "Trener" : "Klijent";
const time = (value: string) =>
  new Date(value).toLocaleString("bs-BA", { timeZone: "Europe/Sarajevo" });
function valueLabel(field: string, value: unknown) {
  if (field === "category")
    return categoryLabels[value as keyof typeof categoryLabels];
  if (field === "status")
    return statusLabels[value as keyof typeof statusLabels];
  return String(value ?? "—") || "—";
}
export default function MedicationRecords({
  clientId,
  readOnly = false,
  logout,
}: {
  clientId?: string;
  readOnly?: boolean;
  logout?: () => void;
}) {
  const [data, setData] = useState<MedicationData | null>(null),
    [target, setTarget] = useState(clientId ?? ""),
    [draft, setDraft] = useState<{
      id: string;
      version: number;
      content: MedicationContent;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const request = useRef(0);
  const load = useCallback(async () => {
    if (readOnly) return;
    const current = ++request.current;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        "/api/medications" +
          (target ? `?client=${encodeURIComponent(target)}` : ""),
        { cache: "no-store" },
      );
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      if (current === request.current) setData(body);
    } catch (e) {
      if (current === request.current)
        setError(e instanceof Error ? e.message : "Evidencija nije dostupna.");
    } finally {
      if (current === request.current) setBusy(false);
    }
  }, [target, readOnly]);
  useEffect(() => {
    setData(null);
    setDraft(null);
    void load();
    return () => {
      request.current++;
    };
  }, [load]);
  async function mutate(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          payload: { ...payload, ...(target ? { clientId: target } : {}) },
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setData(body);
      setDraft(null);
      setNotice(
        action === "grant"
          ? "Dozvola je ažurirana."
          : "Promjena je sačuvana u historiji.",
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
  function fields(record: MedicationContent) {
    return Object.entries(recordLabels)
      .filter(
        ([key]) =>
          !["name", "category", "status"].includes(key) &&
          Boolean(record[key as keyof MedicationContent]),
      )
      .map(([key, label]) => (
        <p key={key} style={{ whiteSpace: "pre-wrap" }}>
          <strong>{label}: </strong>
          {valueLabel(key, record[key as keyof MedicationContent])}
        </p>
      ));
  }
  function card(entry: MedicationRecord) {
    return (
      <article
        className="progress-panel"
        key={entry.id}
        style={{ marginBottom: 20 }}
      >
        <span className="pill sage-pill">
          {categoryLabels[entry.content.category]} ·{" "}
          {statusLabels[entry.content.status]}
        </span>
        <h3>{entry.content.name}</h3>
        {fields(entry.content)}
        <p className="muted">
          Unio/la: {entry.created_name} · {time(entry.created_at)}
          <br />
          Posljednja izmjena: {entry.updated_name} · {time(entry.updated_at)} ·
          V{entry.version}
        </p>
        <div className="cycle-actions">
          <button
            disabled={busy}
            onClick={() =>
              setDraft({
                id: entry.id,
                version: entry.version,
                content: { ...entry.content },
              })
            }
          >
            Uredite unos
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void mutate(entry.removed_at ? "restore" : "remove", {
                id: entry.id,
                version: entry.version,
              })
            }
          >
            {entry.removed_at ? "Vratite unos" : "Uklonite iz evidencije"}
          </button>
        </div>
        <details>
          <summary>Ko je šta unio · historija izmjena</summary>
          {data?.history
            .filter((v) => v.record_id === entry.id)
            .map((v) => {
              const previous = data.history.find(
                (old) =>
                  old.record_id === entry.id && old.version === v.version - 1,
              );
              const changed = Object.keys(recordLabels).filter(
                (key) =>
                  !previous ||
                  previous.content[key as keyof MedicationContent] !==
                    v.content[key as keyof MedicationContent],
              );
              return (
                <section key={v.version} className="checkin-entry">
                  <div>
                    <strong>
                      V{v.version} · {v.actor_name} ({roleName(v.actor_role)})
                    </strong>
                    <p>
                      {time(v.created_at)} ·{" "}
                      {v.removed_at
                        ? "Uklonjeno"
                        : previous?.removed_at
                          ? "Vraćeno"
                          : v.version === 1
                            ? "Kreirano"
                            : "Uređeno"}
                    </p>
                    {changed.map((key) => (
                      <p key={key}>
                        <strong>
                          {recordLabels[key as keyof MedicationContent]}:{" "}
                        </strong>
                        {previous && (
                          <>
                            <del>
                              {valueLabel(
                                key,
                                previous.content[
                                  key as keyof MedicationContent
                                ],
                              )}
                            </del>
                            {" → "}
                          </>
                        )}
                        {valueLabel(
                          key,
                          v.content[key as keyof MedicationContent],
                        )}
                      </p>
                    ))}
                  </div>
                </section>
              );
            })}
        </details>
      </article>
    );
  }
  if (readOnly)
    return (
      <section className="progress-panel">
        <h2>Lijekovi, suplementi i PED</h2>
        <p>
          Administrator može pregledati izgled modula. Lični zapisi i stručne
          izmjene dostupni su klijentu i ovlaštenim članovima njegovog tima.
        </p>
      </section>
    );
  return (
    <section className="cycle-diary">
      {logout && (
        <header className="section-title">
          <h2>Stručna evidencija</h2>
          <button onClick={logout}>Odjavite se</button>
        </header>
      )}
      <div className="section-title">
        <div>
          <span className="eyebrow">EVIDENCIJA S HISTORIJOM</span>
          <h2>Lijekovi, suplementi i PED</h2>
        </div>
      </div>
      <p className="muted">
        Zabilježite korištene proizvode i dogovorene upute. Svaka izmjena čuva
        autora i prethodnu verziju. Evidencija ne predstavlja recept niti
        automatsku preporuku doziranja.
      </p>
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            disabled={busy}
            onClick={() => {
              setDraft(null);
              void load();
            }}
          >
            Osvježite evidenciju
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {busy && !data && <p role="status">Učitavanje…</p>}
      {data && (
        <>
          {data.actor.role !== "client" && (
            <label>
              Klijent
              <select
                aria-label="Klijent za stručnu evidenciju"
                value={target}
                disabled={busy}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Odaberite klijenta</option>
                {data.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {data.actor.role === "client" && (
            <details>
              <summary>Pristup doktora i trenera</summary>
              <p>
                Odabrani stručnjak može vidjeti i uređivati cijelu ovu
                evidenciju, uključujući lijekove, suplemente i PED, te historiju
                izmjena. Isključivanjem dozvole prestaje daljnji pristup.
              </p>
              {!data.team.length && (
                <p>Još nema povezanog doktora ili trenera.</p>
              )}
              {data.team.map((expert) => (
                <label className="medication-access" key={expert.id}>
                  <input
                    type="checkbox"
                    checked={expert.granted}
                    disabled={busy}
                    onChange={(e) =>
                      void mutate("grant", {
                        expertId: expert.id,
                        granted: e.target.checked,
                      })
                    }
                  />
                  {expert.name} · {roleName(expert.role)}
                </label>
              ))}
            </details>
          )}
          {!data.allowed && (
            <p>
              {target
                ? "Klijent još nije odobrio pristup evidenciji. Dozvolu može uključiti u svom modulu."
                : "Odaberite klijenta za pregled evidencije."}
            </p>
          )}
          {data.allowed && (
            <>
              <div className="cycle-actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    setDraft({
                      id: crypto.randomUUID(),
                      version: 0,
                      content: newContent(),
                    })
                  }
                >
                  Dodajte unos
                </button>
              </div>
              {draft && (
                <form className="cycle-form progress-panel" onSubmit={submit}>
                  <h3>{draft.version ? "Uredite unos" : "Novi unos"}</h3>
                  <label>
                    Vrsta
                    <select
                      value={draft.content.category}
                      disabled={busy}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          content: {
                            ...draft.content,
                            category: e.target
                              .value as MedicationContent["category"],
                          },
                        })
                      }
                    >
                      {Object.entries(categoryLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(
                    [
                      "name",
                      "dose",
                      "route",
                      "frequency",
                      "timing",
                      "start",
                      "end",
                    ] as const
                  ).map((key) => (
                    <label key={key}>
                      {recordLabels[key]}
                      <input
                        type={
                          key === "start" || key === "end" ? "date" : "text"
                        }
                        min={
                          key === "start" || key === "end"
                            ? "1900-01-01"
                            : undefined
                        }
                        required={key === "name"}
                        maxLength={
                          key === "timing" ? 300 : key === "route" ? 80 : 120
                        }
                        value={draft.content[key] ?? ""}
                        disabled={busy}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            content: {
                              ...draft.content,
                              [key]: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                  <label>
                    Status
                    <select
                      value={draft.content.status}
                      disabled={busy}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          content: {
                            ...draft.content,
                            status: e.target
                              .value as MedicationContent["status"],
                          },
                        })
                      }
                    >
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Bilješka
                    <textarea
                      maxLength={1000}
                      disabled={busy}
                      value={draft.content.note}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          content: { ...draft.content, note: e.target.value },
                        })
                      }
                    />
                  </label>
                  <div className="cycle-actions">
                    <button disabled={busy}>Sačuvajte u historiju</button>
                    <button
                      disabled={busy}
                      type="button"
                      onClick={() => setDraft(null)}
                    >
                      Odustanite
                    </button>
                  </div>
                </form>
              )}
              {!data.entries.some((e) => !e.removed_at) && (
                <p>Još nema aktivnih unosa.</p>
              )}
              {data.entries.filter((e) => !e.removed_at).map(card)}
              {data.entries.some((e) => e.removed_at) && (
                <details>
                  <summary>Uklonjeni unosi</summary>
                  <p>Uklanjanje je povratno i ostaje vidljivo u historiji.</p>
                  {data.entries.filter((e) => e.removed_at).map(card)}
                </details>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
