"use client";
import { useEffect, useRef, useState } from "react";
import type { LabData } from "@/lib/labs";
import { sarajevoDay } from "@/lib/cycle";
export default function LabRecords({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const [data, setData] = useState<LabData | null>(null),
    [target, setTarget] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [fileName, setFileName] = useState("Datoteka nije odabrana.");
  const serial = useRef(0),
    uploadId = useRef<string | null>(null),
    reviewIds = useRef<Record<string, string>>({});
  useEffect(() => {
    const n = ++serial.current;
    setData(null);
    uploadId.current = null;
    setError("");
    if (readOnly) return;
    fetch(
      "/api/labs" + (target ? "?client=" + encodeURIComponent(target) : ""),
      { cache: "no-store" },
    )
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw Error(b.error);
        if (n === serial.current) setData(b);
      })
      .catch((e) => {
        if (n === serial.current) setError(e.message);
      });
    return () => {
      serial.current++;
    };
  }, [target, readOnly]);
  async function send(body: FormData | object) {
    setBusy(true);
    setError("");
    const n = serial.current;
    try {
      const r = await fetch("/api/labs", {
        method: "POST",
        ...(body instanceof FormData
          ? { body }
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      if (n === serial.current) setData(b);
      return true;
    } catch (e) {
      if (n === serial.current)
        setError(e instanceof Error ? e.message : "Zahtjev nije uspio.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const mutate = (action: string, payload: object) =>
    send({
      action,
      payload: { ...payload, ...(target ? { clientId: target } : {}) },
    });
  async function download(id: string) {
    setError("");
    try {
      const r = await fetch(
        "/api/labs?file=" +
          id +
          (target ? "&client=" + encodeURIComponent(target) : ""),
        { cache: "no-store" },
      );
      if (!r.ok) throw Error((await r.json()).error);
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "TESTNI-NALAZ.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preuzimanje nije uspjelo.");
    }
  }
  if (readOnly)
    return (
      <section className="panel">
        <h2>Nalazi</h2>
        <p>Privatni nalazi nisu dostupni u administratorskom pregledu.</p>
      </section>
    );
  return (
    <section className="medication-records">
      <header>
        <h2>Nalazi i zdravstvena podrška</h2>
        <p>
          Testni prostor: samo izmišljeni PDF nalazi do 2 MB. Ne unosite stvarne
          medicinske podatke.
        </p>
      </header>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Učitavanje nalaza…</p>}
      {data && (
        <>
          {data.actor.role === "doctor" && (
            <label>
              Klijent
              <select
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
            <section className="panel">
              <h3>Pristup doktora testnim nalazima</h3>
              <p>
                Ova dozvola je odvojena od lijekova i drugih privatnih podataka.
              </p>
              {data.team.length ? (
                data.team.map((d) => (
                  <label key={d.id}>
                    <input
                      type="checkbox"
                      checked={d.granted}
                      disabled={busy}
                      onChange={(e) =>
                        void mutate("grant", {
                          doctorId: d.id,
                          granted: e.target.checked,
                        })
                      }
                    />
                    {d.name}
                  </label>
                ))
              ) : (
                <p>Još nemate povezanog doktora.</p>
              )}
            </section>
          )}
          {data.clientId && !data.allowed && (
            <p>Klijent još nije odobrio pristup nalazima.</p>
          )}
          {data.allowed && (
            <>
              <details className="panel lab-upload">
                <summary>Dodajte testni PDF nalaz</summary>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const fd = new FormData(form);
                    uploadId.current ??= crypto.randomUUID();
                    fd.set("id", uploadId.current);
                    if (target) fd.set("clientId", target);
                    if (await send(fd)) {
                      uploadId.current = null;
                      form.reset();
                      setFileName("Datoteka nije odabrana.");
                    }
                  }}
                >
                  <label>
                    Naziv
                    <input name="title" required maxLength={120} />
                  </label>
                  <label>
                    Ustanova
                    <input name="provider" required maxLength={120} />
                  </label>
                  <label>
                    Datum nalaza
                    <input
                      name="date"
                      type="date"
                      required
                      max={sarajevoDay()}
                      defaultValue={sarajevoDay()}
                    />
                  </label>
                  <label className="lab-file-picker">
                    <span>Odaberite PDF datoteku</span>
                    <small>{fileName}</small>
                    <input
                      className="lab-file-input"
                      name="file"
                      type="file"
                      accept="application/pdf,.pdf"
                      required
                      onChange={(e) => {
                        setFileName(
                          e.target.files?.[0]?.name ??
                            "Datoteka nije odabrana.",
                        );
                        uploadId.current = null;
                      }}
                    />
                  </label>
                  <label>
                    <input type="checkbox" required />
                    Potvrđujem da su podaci izmišljeni i dokument jasno označen
                    kao test.
                  </label>
                  <button className="primary" disabled={busy}>
                    Sačuvajte testni nalaz
                  </button>
                </form>
              </details>
              {!data.documents.length && <p>Još nema testnih nalaza.</p>}
              {data.documents.map((d) => (
                <article className="panel" key={d.id}>
                  <span className="badge">
                    TESTNI NALAZ{d.removed_at ? " · Uklonjen" : ""}
                  </span>
                  <h3>{d.title}</h3>
                  <p>
                    {d.provider} · {d.report_date}
                  </p>
                  <p>
                    Dodao/la: {d.uploaded_name} ·{" "}
                    {new Date(d.created_at).toLocaleString("bs-BA")} ·{" "}
                    {Math.ceil(d.file_size / 1024)} KB
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void download(d.id)}
                  >
                    Preuzmite PDF
                  </button>
                  {data.actor.role === "client" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void mutate(d.removed_at ? "restore" : "remove", {
                          id: d.id,
                        })
                      }
                    >
                      {d.removed_at
                        ? "Vratite nalaz"
                        : "Uklonite iz evidencije"}
                    </button>
                  )}
                  <h4>Historija pregleda</h4>
                  {data.reviews
                    .filter((v) => v.document_id === d.id)
                    .map((v) => (
                      <blockquote key={v.id}>
                        <strong>
                          {v.doctor_name} ·{" "}
                          {v.decision === "reviewed"
                            ? "Pregledano"
                            : "Potrebno praćenje"}
                        </strong>
                        <p style={{ whiteSpace: "pre-wrap" }}>{v.note}</p>
                        <small>
                          {new Date(v.created_at).toLocaleString("bs-BA")}
                        </small>
                      </blockquote>
                    ))}
                  {!data.reviews.some((v) => v.document_id === d.id) && (
                    <p>Čeka pregled doktora.</p>
                  )}
                  {data.actor.role === "doctor" && !d.removed_at && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = e.currentTarget;
                        const fd = new FormData(f);
                        if (
                          await mutate("review", {
                            id: d.id,
                            reviewId: String(fd.get("reviewId")),
                            note: String(fd.get("note")),
                            decision: String(fd.get("decision")),
                          })
                        ) {
                          reviewIds.current[d.id] = crypto.randomUUID();
                          f.reset();
                          (
                            f.elements.namedItem("reviewId") as HTMLInputElement
                          ).value = reviewIds.current[d.id];
                        }
                      }}
                    >
                      <input
                        type="hidden"
                        name="reviewId"
                        defaultValue={
                          (reviewIds.current[d.id] ??= crypto.randomUUID())
                        }
                      />
                      <label>
                        Bilješka doktora
                        <textarea name="note" required maxLength={2000} />
                      </label>
                      <label>
                        Status
                        <select name="decision">
                          <option value="reviewed">Pregledano</option>
                          <option value="followUp">Potrebno praćenje</option>
                        </select>
                      </label>
                      <p>
                        Pregledi se trajno bilježe s vašim imenom. Ispravke
                        dodajte kao novu bilješku.
                      </p>
                      <button className="primary" disabled={busy}>
                        Zabilježite pregled
                      </button>
                    </form>
                  )}
                </article>
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
}
