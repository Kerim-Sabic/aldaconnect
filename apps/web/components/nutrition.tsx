"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  Camera,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Flame,
  LoaderCircle,
  Plus,
  Utensils,
} from "lucide-react";
import dynamic from "next/dynamic";
import { productCode, portionCalories, type FoodProduct } from "@/lib/barcode";
const BarcodeCamera = dynamic(() => import("./barcode-camera"), { ssr: false });
import { dayKey, nutritionTotals, type DiaryEntry } from "@/lib/nutrition";

type Props = {
  entries: DiaryEntry[];
  onAdd: (camera?: boolean) => void;
  onWater: () => Promise<unknown>;
  busy: boolean;
  readOnly?: boolean;
};
export default function Nutrition({
  entries,
  onAdd,
  onWater,
  busy,
  readOnly,
}: Props) {
  const [date, setDate] = useState(dayKey());
  const totals = nutritionTotals(entries, date);
  const move = (offset: number) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + offset);
    setDate(dayKey(next));
  };
  const isToday = date === dayKey();
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(`${date}T12:00:00`);
    day.setDate(day.getDate() - 6 + index);
    return {
      date: day,
      calories: nutritionTotals(entries, dayKey(day)).calories,
    };
  });
  const peak = Math.max(...week.map((day) => day.calories), 1);
  return (
    <div className="food-space">
      <div className="food-date-nav">
        <button
          className="icon-button"
          aria-label="Prethodni dan"
          onClick={() => move(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <label>
          <span className="sr-only">Datum dnevnika</span>
          <input
            type="date"
            value={date}
            max={dayKey()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <button
          className="icon-button"
          aria-label="Sljedeći dan"
          disabled={isToday}
          onClick={() => move(1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <section className="calorie-overview">
        <div className="calorie-label">
          <Flame size={17} /> {isToday ? "Danas uneseno" : "Ukupno uneseno"}
        </div>
        <div className="calorie-number">
          {totals.calories.toLocaleString("bs-BA")}
          <span>kcal</span>
        </div>
        <p>
          Zabilježeni obroci: {totals.meals.length}
          {totals.uncounted
            ? ` · ${totals.uncounted} bez unesenih kalorija`
            : " · prema vašim unosima"}
        </p>
        {!readOnly && (
          <div className="food-actions">
            <button
              className="primary"
              onClick={() => {
                setDate(dayKey());
                onAdd(false);
              }}
            >
              <Plus size={18} /> Dodajte obrok
            </button>
            <button
              className="secondary"
              onClick={() => {
                setDate(dayKey());
                onAdd(true);
              }}
            >
              <Camera size={18} /> Skenirajte
            </button>
          </div>
        )}
      </section>
      <div className="food-section-heading">
        <h2>{isToday ? "Današnji obroci" : "Obroci tog dana"}</h2>
        <span>{totals.meals.length} unosa</span>
      </div>
      <section className="meal-list">
        {totals.meals.length ? (
          totals.meals.map((entry) => (
            <div className="meal-row" key={entry.id}>
              <span className="meal-icon">
                <Utensils size={18} />
              </span>
              <div>
                <strong>{entry.label}</strong>
                <small>
                  {new Date(entry.created_at).toLocaleTimeString("bs-BA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </div>
              <span className="meal-kcal">
                {entry.value === null ? "—" : Math.round(entry.value)}
                <small>{entry.value === null ? "bez kalorija" : "kcal"}</small>
              </span>
            </div>
          ))
        ) : (
          <div className="food-empty">
            <Utensils size={26} />
            <h3>
              {isToday ? "Šta je na meniju?" : "Nema zabilježenih obroka."}
            </h3>
            <p>
              {isToday
                ? "Dodajte obrok ručno ili skenirajte barkod s pakovanja."
                : "Ovdje će se prikazati vaši sačuvani unosi."}
            </p>
            {isToday && !readOnly && (
              <button className="text-link" onClick={() => onAdd()}>
                Dodajte prvi obrok <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}
      </section>
      <section className="water-line">
        <span className="meal-icon">
          <Droplets size={20} />
        </span>
        <div>
          <strong>Hidratacija</strong>
          <small>
            {totals.water.toLocaleString("bs-BA")} ml{" "}
            {isToday ? "danas" : "tog dana"}
          </small>
        </div>
        {isToday && !readOnly && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              void onWater().catch(() => {});
            }}
          >
            <Plus size={16} /> 250 ml
          </button>
        )}
      </section>
      <div className="food-section-heading">
        <h2>Posljednjih 7 dana</h2>
        <span>kcal / dan</span>
      </div>
      <section
        className="calorie-week"
        aria-label="Unesene kalorije u posljednjih sedam dana"
      >
        {week.map((day, index) => (
          <div key={dayKey(day.date)}>
            <span>{Math.round(day.calories)}</span>
            <div className="calorie-bar-space">
              <div
                className={index === 6 ? "calorie-bar selected" : "calorie-bar"}
                style={{
                  height: `${Math.max(4, (day.calories / peak) * 100)}%`,
                }}
              />
            </div>
            <small>
              {["N", "P", "U", "S", "Č", "P", "S"][day.date.getDay()]}
            </small>
            <span className="sr-only">
              {day.date.toLocaleDateString("bs-BA")} · {day.calories} kalorija
            </span>
          </div>
        ))}
      </section>
      <p className="food-footnote">
        Vrijednosti s deklaracije odnose se na količinu koju unesete. Provjerite
        podatke prije čuvanja.
      </p>
    </div>
  );
}

export function MealComposer({
  camera = false,
  entries,
  onSave,
  busy,
}: {
  camera?: boolean;
  entries: DiaryEntry[];
  onSave: (label: string, calories: number) => Promise<void>;
  busy: boolean;
}) {
  const [mode, setMode] = useState(camera ? "barcode" : "manual");
  const [label, setLabel] = useState("");
  const [calories, setCalories] = useState("");
  const [portion, setPortion] = useState("");
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("100");
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );
  const lookup = useCallback(async (input: string) => {
    setScanning(false);
    setError("");
    const valid = productCode(input);
    if (!valid) {
      setError("Unesite ispravan broj barkoda s pakovanja.");
      return;
    }
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setLoading(true);
    setProduct(null);
    setCode(valid);
    try {
      const res = await fetch(
        `/api/nutrition/product?code=${encodeURIComponent(valid)}`,
        { signal: abort.signal },
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Proizvod nije pronađen.");
      if (!abort.signal.aborted) {
        setProduct(result);
        setAmount(String(result.serving ?? 100));
      }
    } catch (e) {
      if (!abort.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Provjerite vezu ili unesite obrok ručno.",
        );
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  }, []);
  const changeMode = (next: string) => {
    abortRef.current?.abort();
    setLoading(false);
    setScanning(false);
    setError("");
    setMode(next);
  };
  const computed = product
    ? portionCalories(product.caloriesPer100, Number(amount))
    : 0;
  const save = async (name: string, kcal: number) => {
    setError("");
    try {
      await onSave(name.slice(0, 200), kcal);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Obrok nije sačuvan. Pokušajte ponovo.",
      );
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void save(
      [label.trim(), portion.trim()].filter(Boolean).join(" · "),
      Number(calories),
    );
  };
  const recent = entries
    .filter(
      (entry, index, list) =>
        entry.kind === "meal" &&
        entry.value !== null &&
        list.findIndex((other) => other.label === entry.label) === index,
    )
    .slice(0, 3);
  return (
    <div className="meal-composer">
      <span className="sheet-kicker">DNEVNIK ISHRANE</span>
      <h2 id="dialog-title">Dodajte obrok</h2>
      <p>Vaš obrok. Vaša porcija.</p>
      <div className="meal-mode" role="group" aria-label="Način unosa">
        <button
          aria-pressed={mode === "manual"}
          onClick={() => changeMode("manual")}
        >
          <Utensils size={16} /> Ručno
        </button>
        <button
          aria-pressed={mode === "barcode"}
          onClick={() => changeMode("barcode")}
        >
          <Camera size={17} /> Barkod / QR
        </button>
      </div>
      {error && (
        <p className="food-error" role="alert">
          {error}
        </p>
      )}
      {mode === "barcode" ? (
        <div className="barcode-flow">
          {product ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save(
                  `${product.name} · ${Number(amount)} ${product.unit}`,
                  computed,
                );
              }}
            >
              <div className="barcode-product">
                <span className="meal-icon">
                  <Utensils size={22} />
                </span>
                <div>
                  <small>{product.brand || "Pronađeni proizvod"}</small>
                  <h3>{product.name}</h3>
                  <p>
                    {product.caloriesPer100} kcal / 100 {product.unit}
                  </p>
                </div>
              </div>
              <label>
                Količina koju ste pojeli · {product.unit}
                <input
                  autoFocus
                  required
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  max="5000"
                  step="0.1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <div className="portion-total">
                <span>Vaša porcija</span>
                <strong>
                  {Number.isFinite(computed) ? computed : 0}
                  <small> kcal</small>
                </strong>
              </div>
              <p className="food-footnote">
                Podaci:{" "}
                <a href={product.source} target="_blank" rel="noreferrer">
                  Open Food Facts
                </a>{" "}
                ·{" "}
                <a
                  href="https://opendatacommons.org/licenses/odbl/1-0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  ODbL
                </a>
                . Provjerite deklaraciju na pakovanju.
              </p>
              <button
                className="primary full"
                disabled={
                  busy || !Number.isFinite(computed) || computed > 10000
                }
              >
                {busy ? (
                  <LoaderCircle className="spinning" size={18} />
                ) : (
                  <Plus size={18} />
                )}{" "}
                {busy ? "Čuvamo…" : "Sačuvajte obrok"}
              </button>
              <div className="food-actions">
                <button
                  className="text-link"
                  type="button"
                  onClick={() => {
                    setLabel(product.name);
                    setCalories(String(computed));
                    setPortion(`${amount} ${product.unit}`);
                    changeMode("manual");
                  }}
                >
                  Uredite ručno
                </button>
                <button
                  className="text-link"
                  type="button"
                  onClick={() => {
                    setProduct(null);
                    setCode("");
                  }}
                >
                  Drugi proizvod
                </button>
              </div>
            </form>
          ) : (
            <>
              {scanning ? (
                <BarcodeCamera
                  onCode={lookup}
                  onClose={() => setScanning(false)}
                />
              ) : (
                <div className="camera-placeholder">
                  <span>
                    <Camera size={32} />
                  </span>
                  <h3>Skenirajte pakovanje.</h3>
                  <p>
                    Barkod ili QR s kodom proizvoda. Zatim odaberite količinu.
                  </p>
                  <button
                    className="primary"
                    disabled={loading}
                    onClick={() => {
                      setError("");
                      setScanning(true);
                    }}
                  >
                    <Camera size={18} /> Otvorite kameru
                  </button>
                </div>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void lookup(code);
                }}
              >
                <label>
                  Broj ispod barkoda
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={24}
                    placeholder="npr. 3017620422003"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
                <button className="secondary full" disabled={loading}>
                  {loading ? (
                    <LoaderCircle className="spinning" size={18} />
                  ) : (
                    <ArrowRight size={18} />
                  )}{" "}
                  {loading ? "Tražimo proizvod…" : "Pronađite proizvod"}
                </button>
              </form>
              <p className="food-footnote">
                Kamera čita kod na vašem uređaju. Šaljemo samo broj proizvoda u
                bazu Open Food Facts. Za hranu bez barkoda koristite ručni unos.
              </p>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={submit}>
          <label>
            Šta ste jeli?
            <input
              name="meal"
              required
              maxLength={160}
              placeholder="npr. Piletina s rižom"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <div className="meal-fields">
            <label>
              Kalorije · kcal
              <input
                required
                type="number"
                inputMode="numeric"
                min={0}
                max={10000}
                step={1}
                placeholder="450"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
            </label>
            <label>
              Porcija · opcionalno
              <input
                maxLength={100}
                placeholder="npr. 1 tanjir"
                value={portion}
                onChange={(e) => setPortion(e.target.value)}
              />
            </label>
          </div>
          <button className="primary full" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spinning" size={18} />
            ) : (
              <Plus size={18} />
            )}{" "}
            {busy ? "Čuvamo…" : "Sačuvajte obrok"}
          </button>
          {recent.length > 0 && !label && (
            <div className="recent-meals">
              <h3>Nedavno zabilježeno</h3>
              {recent.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setLabel(entry.label.slice(0, 160));
                    setCalories(String(entry.value));
                    setPortion("");
                  }}
                >
                  <span>{entry.label}</span>
                  <small>{entry.value} kcal</small>
                  <Plus size={15} />
                </button>
              ))}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
