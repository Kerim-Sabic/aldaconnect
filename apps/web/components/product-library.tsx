"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowUpRight,
  Barcode,
  Check,
  Plus,
  Search,
  Package,
  LoaderCircle,
  Camera,
} from "lucide-react";
import type { FoodProduct } from "@/lib/barcode";
import ProductEditor from "./product-editor";
const BarcodeCamera = dynamic(() => import("./barcode-camera"), { ssr: false });
export default function ProductLibrary({
  admin = false,
  readOnly = false,
}: {
  admin?: boolean;
  readOnly?: boolean;
}) {
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(false);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{
    code?: string;
    initial?: FoodProduct;
  } | null>(null);
  const [selected, setSelected] = useState<FoodProduct | null>(null);
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      void fetch(
        "/api/nutrition/foods?" +
          new URLSearchParams({ q: query, mine: String(mine) }),
        { signal: abort.signal },
      )
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw Error(data.error);
          if (!abort.signal.aborted) setProducts(data.products);
        })
        .catch((e) => {
          if (!abort.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [query, mine, reload]);
  const mutate = async (
    action: "report" | "moderate",
    payload: Record<string, unknown>,
  ) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/nutrition/foods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, code: selected!.code, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      setSelected(null);
      setNotice(
        action === "report"
          ? "Hvala. Administrator će pregledati prijavu."
          : "Dostupnost proizvoda je ažurirana.",
      );
      setReload((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (editor)
    return (
      <section className="product-library">
        <ProductEditor
          key={editor.initial?.code ?? editor.code ?? "new"}
          {...editor}
          onCancel={() => setEditor(null)}
          onSaved={(p) => {
            setEditor(null);
            setSelected(p);
            setNotice("Proizvod je sačuvan i dostupan svim korisnicima.");
            setReload((v) => v + 1);
          }}
        />
      </section>
    );
  return (
    <section className="product-library">
      {selected ? (
        <>
          <button
            className="text-link"
            onClick={() => {
              setSelected(null);
              setReport("");
              setError("");
            }}
          >
            <ArrowLeft size={16} /> Svi proizvodi
          </button>
          <div className="catalog-detail">
            <div className="catalog-eyebrow">
              <Package size={15} /> PODACI S DEKLARACIJE
            </div>
            <h2>{selected.name}</h2>
            <p>{selected.brand || "Zajednički katalog"}</p>
            <div className="catalog-energy">
              <strong>{selected.caloriesPer100}</strong>
              <span>kcal / 100 {selected.unit}</span>
            </div>
            <dl>
              {(
                [
                  ["protein", "Proteini"],
                  ["carbs", "Ugljikohidrati"],
                  ["fat", "Masti"],
                  ["sugars", "Šećeri"],
                  ["fiber", "Vlakna"],
                  ["saturated", "Zasićene masti"],
                  ["salt", "Sol"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {selected[key] ?? "—"}
                    {selected[key] != null ? " g" : ""}
                  </dd>
                </div>
              ))}
            </dl>
            {selected.serving && (
              <p>
                Porcija: {selected.serving} {selected.unit}
              </p>
            )}
            {selected.packageQuantity && (
              <p>
                Pakovanje: {selected.packageQuantity} {selected.unit}
              </p>
            )}
            {selected.ingredients && (
              <div>
                <h3>Sastojci</h3>
                <p>{selected.ingredients}</p>
              </div>
            )}
            {selected.allergens && (
              <div>
                <h3>Alergeni</h3>
                <p>{selected.allergens}</p>
              </div>
            )}
            {selected.description && <p>{selected.description}</p>}
            <small className="food-footnote">
              Dodano u zajednički katalog. Provjerite deklaraciju na pakovanju.
            </small>
            {!readOnly && selected.canEdit && (
              <button
                className="secondary"
                onClick={() => setEditor({ initial: selected })}
              >
                Uredite deklaraciju <ArrowUpRight size={16} />
              </button>
            )}
            {!readOnly && !selected.canEdit && (
              <details>
                <summary>Prijavite netačan podatak</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate("report", { reason: report });
                  }}
                >
                  <label>
                    Šta treba ispraviti?
                    <textarea
                      value={report}
                      onChange={(e) => setReport(e.target.value)}
                      required
                      minLength={3}
                      maxLength={300}
                    />
                  </label>
                  <button className="secondary" disabled={busy}>
                    Pošaljite prijavu
                  </button>
                </form>
              </details>
            )}
            {admin && (
              <>
                <div className="catalog-reports">
                  {selected.reports?.map((r, i) => (
                    <p key={i}>{r.reason}</p>
                  ))}
                </div>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void mutate("moderate", { hidden: !selected.hidden })
                  }
                >
                  {selected.hidden ? "Vratite u katalog" : "Sakrijte proizvod"}
                </button>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="catalog-heading">
            <div>
              <span className="catalog-eyebrow">ALDA KATALOG</span>
              <h2>
                Dobro poznati.
                <br />
                Jednom sačuvani.
              </h2>
              <p>
                Dodajte deklaraciju. Sljedeće skeniranje prepoznat će proizvod —
                za vas i sve ostale.
              </p>
            </div>
            {!readOnly && (
              <button
                className="primary"
                onClick={() => {
                  setNotice("");
                  setEditor({});
                }}
              >
                <Plus size={18} /> Dodajte proizvod
              </button>
            )}
          </div>
          <div className="catalog-controls">
            <label className="catalog-search">
              <Search size={18} />
              <input
                aria-label="Pretražite katalog"
                placeholder="Naziv, brend ili barkod"
                maxLength={80}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              className="secondary"
              onClick={() => setScanning((v) => !v)}
              aria-expanded={scanning}
            >
              <Camera size={17} /> Skenirajte
            </button>
          </div>
          {scanning && (
            <BarcodeCamera
              onClose={() => setScanning(false)}
              onCode={async (code) => {
                setScanning(false);
                setLoading(true);
                try {
                  const r = await fetch("/api/nutrition/foods?code=" + code);
                  const d = await r.json();
                  if (!r.ok) throw Error(d.error);
                  if (d.product) setSelected(d.product);
                  else if (!readOnly) setEditor({ code });
                  else
                    setNotice("Ovaj proizvod još nije u zajedničkom katalogu.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setLoading(false);
                }
              }}
            />
          )}
          <div
            className="catalog-tabs"
            role="group"
            aria-label="Prikaz kataloga"
          >
            <button aria-pressed={!mine} onClick={() => setMine(false)}>
              Zajednički katalog
            </button>
            <button aria-pressed={mine} onClick={() => setMine(true)}>
              Moji proizvodi
            </button>
          </div>
          {loading ? (
            <p className="catalog-empty" role="status">
              <LoaderCircle className="spinning" size={20} /> Učitavamo katalog…
            </p>
          ) : products.length ? (
            <div className="catalog-list">
              {products.map((p) => (
                <button
                  key={p.code}
                  onClick={() => {
                    setSelected(p);
                    setError("");
                    setNotice("");
                  }}
                >
                  <span className="catalog-product-icon">
                    <Package size={21} />
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.brand || "Deklaracija korisnika"}
                      {p.hidden ? " · Skriveno" : ""}
                      {p.reports?.length
                        ? " · " + p.reports.length + " prijava"
                        : ""}
                    </small>
                    <small>
                      {p.caloriesPer100} kcal / 100 {p.unit}
                    </small>
                  </span>
                  <ArrowUpRight size={18} />
                </button>
              ))}
            </div>
          ) : (
            !error && (
              <div className="catalog-empty">
                <Barcode size={30} />
                <h3>
                  {query ? "Nema rezultata" : "Ovdje počinje vaš katalog."}
                </h3>
                <p>
                  {query
                    ? "Pokušajte drugi naziv ili dodajte novi proizvod."
                    : "Proizvodi koje korisnici dodaju pojavljuju se ovdje. Za međunarodne proizvode koristite pretragu u dnevniku ishrane."}
                </p>
                {!readOnly && (
                  <button className="text-link" onClick={() => setEditor({})}>
                    Dodajte prvi proizvod <Plus size={16} />
                  </button>
                )}
              </div>
            )
          )}
        </>
      )}
      {notice && (
        <p className="catalog-notice" role="status">
          <Check size={17} />
          {notice}
        </p>
      )}
      {error && (
        <p className="food-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
