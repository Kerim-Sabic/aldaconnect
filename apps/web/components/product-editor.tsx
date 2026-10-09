"use client";
import { useState } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import type { FoodProduct } from "@/lib/barcode";
import { productCode } from "@/lib/barcode";
const nutrients = [
  ["protein", "Proteini"],
  ["carbs", "Ugljikohidrati"],
  ["fat", "Masti"],
  ["sugars", "Od toga šećeri"],
  ["fiber", "Vlakna"],
  ["saturated", "Zasićene masti"],
  ["salt", "Sol"],
] as const;
export default function ProductEditor({
  initial,
  code: initialCode = "",
  onSaved,
  onCancel,
}: {
  initial?: FoodProduct;
  code?: string;
  onSaved: (p: FoodProduct) => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unit, setUnit] = useState(initial?.unit ?? "g");
  return (
    <form
      className="product-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        const fields = new FormData(e.currentTarget);
        setError("");
        const code = productCode(String(fields.get("code") ?? ""));
        if (!code) {
          setError("Provjerite broj barkoda na pakovanju.");
          return;
        }
        const number = (key: string) =>
          fields.get(key) === "" ? null : Number(fields.get(key));
        const product = {
          name: String(fields.get("name")).trim(),
          brand: String(fields.get("brand")).trim(),
          unit,
          caloriesPer100: number("caloriesPer100"),
          serving: number("serving"),
          packageQuantity: number("packageQuantity"),
          ingredients: String(fields.get("ingredients")),
          allergens: String(fields.get("allergens")),
          description: String(fields.get("description")),
          ...Object.fromEntries(nutrients.map(([key]) => [key, number(key)])),
        };
        setBusy(true);
        try {
          const res = await fetch("/api/nutrition/foods", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "save",
              code,
              product,
              ...(initial?.version ? { version: initial.version } : {}),
            }),
          });
          const data = await res.json();
          if (!res.ok) throw Error(data.error);
          onSaved(data.product);
        } catch (e) {
          setError(
            e instanceof Error
              ? e.message
              : "Proizvod nije sačuvan. Pokušajte ponovo.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="catalog-eyebrow">
        <Check size={14} /> ZAJEDNIČKI KATALOG
      </div>
      <h3>{initial?.version ? "Uredite deklaraciju" : "Dodajte proizvod"}</h3>
      <p>
        Prepišite podatke s pakovanja. Nakon čuvanja, proizvod će biti dostupan
        svim Alda korisnicima.
      </p>
      <fieldset disabled={busy}>
        <label>
          Barkod
          <input
            name="code"
            defaultValue={initial?.code ?? initialCode}
            readOnly={Boolean(initial?.version)}
            required
            inputMode="numeric"
            maxLength={14}
            placeholder="Broj ispod barkoda"
          />
        </label>
        <label>
          Naziv proizvoda
          <input
            name="name"
            required
            minLength={2}
            maxLength={160}
            defaultValue={initial?.name}
            placeholder="npr. Zobene pahuljice"
          />
        </label>
        <label>
          Brend
          <input
            name="brand"
            maxLength={80}
            defaultValue={initial?.brand ?? ""}
            placeholder="Opcionalno"
          />
        </label>
        <div className="product-fields">
          <label>
            Deklaracija za
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as "g" | "ml")}
            >
              <option value="g">100 g</option>
              <option value="ml">100 ml</option>
            </select>
          </label>
          <label>
            Energija · kcal
            <input
              name="caloriesPer100"
              type="number"
              inputMode="decimal"
              min={0}
              max={1000}
              step="0.1"
              required
              defaultValue={initial?.caloriesPer100}
            />
          </label>
        </div>
        <div className="product-section-title">
          Nutrijenti na 100 {unit} <span>u gramima</span>
        </div>
        <div className="product-fields">
          {nutrients.map(([key, label], i) => (
            <label key={key}>
              {label}
              {i > 2 && <small>opcionalno</small>}
              <input
                name={key}
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                required={i < 3}
                defaultValue={initial?.[key] ?? ""}
                placeholder={i < 3 ? "0" : "—"}
              />
            </label>
          ))}
        </div>
        <details>
          <summary>
            Porcija, pakovanje i sastav <span>Opcionalno</span>
          </summary>
          <div className="product-fields">
            <label>
              Porcija · {unit}
              <input
                name="serving"
                type="number"
                min={0.1}
                max={5000}
                step="0.1"
                inputMode="decimal"
                defaultValue={initial?.serving ?? ""}
              />
            </label>
            <label>
              Pakovanje · {unit}
              <input
                name="packageQuantity"
                type="number"
                min={0.1}
                max={100000}
                step="0.1"
                inputMode="decimal"
                defaultValue={initial?.packageQuantity ?? ""}
              />
            </label>
          </div>
          <label>
            Sastojci
            <textarea
              name="ingredients"
              maxLength={1000}
              rows={3}
              defaultValue={initial?.ingredients}
            />
          </label>
          <label>
            Alergeni
            <input
              name="allergens"
              maxLength={300}
              defaultValue={initial?.allergens}
            />
          </label>
          <label>
            Napomena
            <textarea
              name="description"
              maxLength={500}
              rows={2}
              defaultValue={initial?.description}
            />
          </label>
        </details>
      </fieldset>
      {error && (
        <p className="food-error" role="alert">
          {error}
        </p>
      )}
      <div className="product-editor-actions">
        <button
          type="button"
          className="secondary"
          onClick={onCancel}
          disabled={busy}
        >
          Nazad
        </button>
        <button className="primary" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spinning" size={17} />
          ) : (
            <ArrowRight size={17} />
          )}{" "}
          {busy ? "Čuvamo…" : "Sačuvajte proizvod"}
        </button>
      </div>
      <small className="food-footnote">
        Unesite samo podatke proizvoda. Provjerite deklaraciju prije korištenja.
      </small>
    </form>
  );
}
